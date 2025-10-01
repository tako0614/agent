import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';
import { Google } from 'arctic';

type Bindings = {
  DATABASE_URL?: string;
  MCP_GOOGLE_CLIENT_ID?: string;
  MCP_GOOGLE_CLIENT_SECRET?: string;
  MCP_GOOGLE_REDIRECT_URI?: string;
  MCP_ISSUER?: string; // OAuth issuer URL (this server)
  JWT_SECRET?: string; // Secret for signing JWTs
};

const oauth = new Hono<{ Bindings: Bindings }>();

/**
 * RFC 8414: Authorization Server Metadata
 * https://datatracker.ietf.org/doc/html/rfc8414
 */
oauth.get('/.well-known/oauth-authorization-server', (c) => {
  const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';
  
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    jwks_uri: `${issuer}/oauth/jwks`,
    scopes_supported: [
      'booking:read',
      'booking:write',
      'product:read',
      'product:write',
      'order:read',
      'order:write',
      'form:read',
      'form:write',
    ],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    // RFC 8707: Resource Indicators
    resource_documentation: `${issuer}/.well-known/oauth-protected-resource`,
  });
});

/**
 * RFC 9728: Protected Resource Metadata (PRM)
 * https://datatracker.ietf.org/doc/html/rfc9728
 */
oauth.get('/.well-known/oauth-protected-resource', (c) => {
  const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';
  
  return c.json({
    resource: issuer,
    authorization_servers: [issuer],
    scopes_supported: [
      'booking:read',
      'booking:write',
      'product:read',
      'product:write',
      'order:read',
      'order:write',
      'form:read',
      'form:write',
    ],
    token_types_supported: ['Bearer'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: ['HS256'],
  });
});

/**
 * OAuth 2.1 Authorization Endpoint
 * Implements Authorization Code flow with PKCE (RFC 7636)
 */
oauth.get('/authorize', async (c) => {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method = 'S256',
    resource, // RFC 8707: Resource Indicators
  } = c.req.query();

  // Validate required parameters
  if (!response_type || response_type !== 'code') {
    return c.json({ error: 'unsupported_response_type' }, 400);
  }

  if (!client_id || !redirect_uri || !code_challenge) {
    return c.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, 400);
  }

  if (code_challenge_method !== 'S256') {
    return c.json({ error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' }, 400);
  }

  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) {
    return c.json({ error: 'server_error', error_description: 'Database not configured' }, 500);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    // Verify client exists and redirect_uri matches
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: client_id },
    });

    if (!client) {
      await prisma.$disconnect();
      return c.json({ error: 'invalid_client' }, 401);
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      await prisma.$disconnect();
      return c.json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' }, 400);
    }

    // Check if user is authenticated
    const cookies = c.req.header('Cookie');
    const sessionCookie = cookies?.split(';').find((c: string) => c.trim().startsWith('mcp_session='));
    
    if (!sessionCookie) {
      // User not authenticated - redirect to login with Google OAuth
      await prisma.$disconnect();
      
      // Store authorization request in session
      const authRequestId = crypto.randomUUID();
      const authRequestData = {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        resource,
      };
      
      c.header('Set-Cookie', `mcp_auth_request=${authRequestId}:${btoa(JSON.stringify(authRequestData))}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
      
      return c.redirect('/auth/login/google');
    }

    // User authenticated - show consent screen or auto-approve
    const sessionToken = sessionCookie.split('=')[1];
    const sessionData = JSON.parse(atob(sessionToken));
    
    // For now, auto-approve (in production, show consent screen)
    const code = crypto.randomUUID();
    const scopeArray = scope ? scope.split(' ') : [];
    
    // Store authorization code
    await prisma.authorizationCode.create({
      data: {
        code,
        clientId: client_id,
        userId: sessionData.userId,
        redirectUri: redirect_uri,
        scope: scopeArray,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        resource: resource || null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    await prisma.$disconnect();

    // Redirect back to client with authorization code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return c.redirect(redirectUrl.toString());
  } catch (error) {
    await prisma.$disconnect();
    console.error('Authorization error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
});

/**
 * OAuth 2.1 Token Endpoint
 * Exchanges authorization code for access token
 */
oauth.post('/token', async (c) => {
  const body = await c.req.parseBody();
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    code_verifier,
    refresh_token,
  } = body as Record<string, string>;

  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) {
    return c.json({ error: 'server_error', error_description: 'Database not configured' }, 500);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    if (grant_type === 'authorization_code') {
      // Validate required parameters
      if (!code || !redirect_uri || !client_id || !code_verifier) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_request' }, 400);
      }

      // Find authorization code
      const authCode = await prisma.authorizationCode.findUnique({
        where: { code },
        include: { client: true, user: true },
      });

      if (!authCode) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant' }, 400);
      }

      // Verify code hasn't expired
      if (authCode.expiresAt < new Date()) {
        await prisma.authorizationCode.delete({ where: { id: authCode.id } });
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant', error_description: 'Authorization code expired' }, 400);
      }

      // Verify client_id and redirect_uri match
      if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant' }, 400);
      }

      // Verify PKCE code_verifier
      const encoder = new TextEncoder();
      const data = encoder.encode(code_verifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      if (challenge !== authCode.codeChallenge) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' }, 400);
      }

      // Generate access token (JWT)
      const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';
      const jwtSecret = new TextEncoder().encode(c.env.JWT_SECRET || 'default-secret-change-in-production');
      
      const accessToken = await new SignJWT({
        sub: authCode.userId,
        client_id: authCode.clientId,
        scope: authCode.scope,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(authCode.resource || issuer)
        .setExpirationTime('1h')
        .sign(jwtSecret);

      // Generate refresh token
      const refreshTokenValue = crypto.randomUUID();

      // Store tokens in database
      await prisma.accessToken.create({
        data: {
          token: accessToken,
          clientId: authCode.clientId,
          userId: authCode.userId,
          scope: authCode.scope,
          resource: authCode.resource,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          clientId: authCode.clientId,
          userId: authCode.userId,
          scope: authCode.scope,
          resource: authCode.resource,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Delete authorization code (one-time use)
      await prisma.authorizationCode.delete({ where: { id: authCode.id } });

      await prisma.$disconnect();

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshTokenValue,
        scope: authCode.scope.join(' '),
      });
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token || !client_id) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_request' }, 400);
      }

      // Find refresh token
      const refreshTokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refresh_token },
        include: { user: true },
      });

      if (!refreshTokenRecord || refreshTokenRecord.clientId !== client_id) {
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant' }, 400);
      }

      // Check expiration
      if (refreshTokenRecord.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } });
        await prisma.$disconnect();
        return c.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, 400);
      }

      // Generate new access token
      const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';
      const jwtSecret = new TextEncoder().encode(c.env.JWT_SECRET || 'default-secret-change-in-production');
      
      const accessToken = await new SignJWT({
        sub: refreshTokenRecord.userId,
        client_id: refreshTokenRecord.clientId,
        scope: refreshTokenRecord.scope,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(refreshTokenRecord.resource || issuer)
        .setExpirationTime('1h')
        .sign(jwtSecret);

      // Store new access token
      await prisma.accessToken.create({
        data: {
          token: accessToken,
          clientId: refreshTokenRecord.clientId,
          userId: refreshTokenRecord.userId,
          scope: refreshTokenRecord.scope,
          resource: refreshTokenRecord.resource,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      await prisma.$disconnect();

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: refreshTokenRecord.scope.join(' '),
      });
    } else {
      await prisma.$disconnect();
      return c.json({ error: 'unsupported_grant_type' }, 400);
    }
  } catch (error) {
    await prisma.$disconnect();
    console.error('Token error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
});

/**
 * Dynamic Client Registration (RFC 7591)
 * https://datatracker.ietf.org/doc/html/rfc7591
 */
oauth.post('/register', async (c) => {
  const body = await c.req.json();
  const {
    client_name,
    redirect_uris,
    grant_types = ['authorization_code'],
    response_types = ['code'],
    scope,
  } = body;

  if (!client_name || !redirect_uris || !Array.isArray(redirect_uris)) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) {
    return c.json({ error: 'server_error' }, 500);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const clientId = crypto.randomUUID();
    const scopeArray = scope ? scope.split(' ') : [];

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: null, // Public client
        name: client_name,
        redirectUris: redirect_uris,
        grantTypes: grant_types,
        responseTypes: response_types,
        scopes: scopeArray,
        tokenEndpointAuthMethod: 'none',
        isPublic: true,
      },
    });

    await prisma.$disconnect();

    return c.json({
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: client.responseTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    }, 201);
  } catch (error) {
    await prisma.$disconnect();
    console.error('Client registration error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
});

/**
 * JWKS endpoint (for JWT verification)
 */
oauth.get('/jwks', (c) => {
  // For HS256, we don't expose the secret
  // In production, use RS256 and expose public keys here
  return c.json({
    keys: []
  });
});

export default oauth;

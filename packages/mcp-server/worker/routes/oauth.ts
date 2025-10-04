import { Hono } from 'hono';
import { z } from 'zod';
import { SignJWT } from 'jose';
import type { AppVariables, Bindings } from '../types';

const encoder = new TextEncoder();

const AUTHORIZATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal('S256'),
});

const tokenSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token', 'client_credentials']),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  code_verifier: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

type AuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  userId: string | null;
  expiresAt: number;
};

type RefreshTokenData = {
  token: string;
  userId: string;
  clientId: string;
  scope: string;
  expiresAt: number;
};

const oauthRouter = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// In-memory storage (for demo purposes - use D1 in production)
const authCodes = new Map<string, AuthorizationCode>();
const refreshTokens = new Map<string, RefreshTokenData>();

const generateRandomString = (length: number): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (plain: string): Promise<string> => {
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const signToken = async (
  payload: Record<string, unknown>,
  secret: string,
  issuer: string,
  expiresIn: number
): Promise<string> => {
  const secretKey = encoder.encode(secret);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secretKey);
};

// GET /auth/authorize - OAuth 2.1 Authorization Endpoint
oauthRouter.get('/authorize', async (c) => {
  try {
    const params = authorizeSchema.parse({
      response_type: c.req.query('response_type'),
      client_id: c.req.query('client_id'),
      redirect_uri: c.req.query('redirect_uri'),
      scope: c.req.query('scope'),
      state: c.req.query('state'),
      code_challenge: c.req.query('code_challenge'),
      code_challenge_method: c.req.query('code_challenge_method'),
    });

    // TODO: In production, implement proper client validation and user authentication
    // For now, we'll create an authorization code without user interaction
    
    const code = generateRandomString(32);
    const now = Date.now();

    const authCode: AuthorizationCode = {
      code,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      scope: params.scope || 'openid profile',
      codeChallenge: params.code_challenge,
      userId: null, // TODO: Get from authenticated session
      expiresAt: now + AUTHORIZATION_CODE_EXPIRY,
    };

    authCodes.set(code, authCode);

    // Clean up expired codes
    setTimeout(() => {
      authCodes.delete(code);
    }, AUTHORIZATION_CODE_EXPIRY);

    // Build redirect URI with code and state
    const redirectUrl = new URL(params.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }

    return c.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'invalid_request',
          error_description: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        400
      );
    }

    return c.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// POST /auth/token - OAuth 2.1 Token Endpoint
oauthRouter.post('/token', async (c) => {
  try {
    const body = await c.req.parseBody();
    const params = tokenSchema.parse(body);

    const issuer = c.env.MCP_ISSUER || new URL(c.req.url).origin;
    const secret = c.env.JWT_SECRET;

    // Authorization Code Grant
    if (params.grant_type === 'authorization_code') {
      if (!params.code || !params.redirect_uri || !params.code_verifier) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Missing required parameters for authorization_code grant',
          },
          400
        );
      }

      const authCode = authCodes.get(params.code);

      if (!authCode) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, 400);
      }

      if (authCode.expiresAt < Date.now()) {
        authCodes.delete(params.code);
        return c.json({ error: 'invalid_grant', error_description: 'Authorization code expired' }, 400);
      }

      if (authCode.redirectUri !== params.redirect_uri) {
        return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
      }

      // Verify PKCE code challenge
      const computedChallenge = await sha256(params.code_verifier);
      if (computedChallenge !== authCode.codeChallenge) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code verifier' }, 400);
      }

      // Delete the authorization code (single use)
      authCodes.delete(params.code);

      // Generate tokens
      const userId = authCode.userId || 'anonymous';
      const scope = authCode.scope;

      const accessToken = await signToken(
        {
          sub: userId,
          scope,
          token_type: 'access_token',
        },
        secret,
        issuer,
        ACCESS_TOKEN_EXPIRY
      );

      const refreshToken = generateRandomString(32);
      const refreshTokenData: RefreshTokenData = {
        token: refreshToken,
        userId,
        clientId: authCode.clientId,
        scope,
        expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY * 1000,
      };

      refreshTokens.set(refreshToken, refreshTokenData);

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        refresh_token: refreshToken,
        scope,
      });
    }

    // Refresh Token Grant
    if (params.grant_type === 'refresh_token') {
      if (!params.refresh_token) {
        return c.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token parameter' },
          400
        );
      }

      const refreshTokenData = refreshTokens.get(params.refresh_token);

      if (!refreshTokenData) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
      }

      if (refreshTokenData.expiresAt < Date.now()) {
        refreshTokens.delete(params.refresh_token);
        return c.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, 400);
      }

      const accessToken = await signToken(
        {
          sub: refreshTokenData.userId,
          scope: refreshTokenData.scope,
          token_type: 'access_token',
        },
        secret,
        issuer,
        ACCESS_TOKEN_EXPIRY
      );

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        scope: refreshTokenData.scope,
      });
    }

    // Client Credentials Grant
    if (params.grant_type === 'client_credentials') {
      if (!params.client_id || !params.client_secret) {
        return c.json(
          { error: 'invalid_request', error_description: 'Missing client credentials' },
          400
        );
      }

      // TODO: Implement proper client authentication
      // For now, we'll accept any client_id/client_secret combination

      const scope = params.scope || 'mcp.registry.read mcp.discovery.read';

      const accessToken = await signToken(
        {
          sub: params.client_id,
          scope,
          token_type: 'access_token',
        },
        secret,
        issuer,
        ACCESS_TOKEN_EXPIRY
      );

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        scope,
      });
    }

    return c.json({ error: 'unsupported_grant_type' }, 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'invalid_request',
          error_description: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        400
      );
    }

    return c.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export { oauthRouter };

import { jwtVerify } from 'jose';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { AppVariables, AuthContext, Bindings } from '../types';

const encoder = new TextEncoder();

type ScopeOptions = {
  optional?: boolean;
  requiredScopes?: string[];
};

type ScopedContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

const extractScopes = (raw?: unknown): string[] => {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map(String);
  }

  if (typeof raw === 'string') {
    const scopes = raw
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
    console.log('Extracted scopes from string:', scopes);
    return scopes;
  }

  return [];
};

export const authenticate = async (
  c: ScopedContext,
  options: ScopeOptions = {}
): Promise<AuthContext | null> => {
  const authorization = c.req.header('authorization');

  if (!authorization) {
    if (options.optional) {
      return null;
    }

    throw new HTTPException(401, {
      res: c.json({ error: 'missing_authorization_header' }, 401),
    });
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HTTPException(401, {
      res: c.json({ error: 'invalid_authorization_header' }, 401),
    });
  }

  try {
    const secret = encoder.encode(c.env.JWT_SECRET);
    const issuer = c.env.MCP_ISSUER || c.env.MCP_SERVER_URL || 'agent-worker';
    const { payload } = await jwtVerify(token, secret, {
      issuer: issuer,
    });

    console.log('JWT verified successfully. Payload:', payload);

    const scopes = extractScopes(payload.scope ?? payload.scopes);
    const userId = typeof payload.sub === 'string' ? payload.sub : null;

    const requiredScopes = options.requiredScopes ?? [];
    const missingScope = requiredScopes.find((scope) => !scopes.includes(scope));

    if (missingScope) {
      console.log('Missing scope:', missingScope, 'User scopes:', scopes);
      throw new HTTPException(403, {
        res: c.json({ error: 'insufficient_scope', missing: missingScope }, 403),
      });
    }

    if (!userId) {
      console.log('No userId found in token');
      throw new HTTPException(403, {
        res: c.json({ error: 'invalid_subject' }, 403),
      });
    }

    const auth: AuthContext = {
      userId,
      scopes,
      token,
    };

    c.set('auth', auth);

    return auth;
  } catch (error) {
    console.error('JWT verification failed:', error);
    
    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(401, {
      res: c.json({ error: 'invalid_token', details: error instanceof Error ? error.message : 'Unknown error' }, 401),
    });
  }
};

export const requireAuth = (requiredScopes: string[] = []) =>
  createMiddleware<{ Bindings: Bindings; Variables: AppVariables }>(async (c, next) => {
    await authenticate(c, { requiredScopes });
    await next();
  });

export const optionalAuth = () =>
  createMiddleware<{ Bindings: Bindings; Variables: AppVariables }>(async (c, next) => {
    await authenticate(c, { optional: true });
    await next();
  });


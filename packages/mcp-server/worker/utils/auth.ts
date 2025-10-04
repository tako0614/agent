import { jwtVerify } from 'jose';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { AppVariables, AuthContext, Bindings } from '../types';

const encoder = new TextEncoder();

type ScopeCheckOptions = {
  optional?: boolean;
};

type ScopedContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

const extractScopes = (payloadScope?: unknown): string[] => {
  if (!payloadScope) return [];
  if (Array.isArray(payloadScope)) {
    return payloadScope.map(String);
  }

  if (typeof payloadScope === 'string') {
    return payloadScope
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  return [];
};

export const authenticate = async (
  c: ScopedContext,
  requiredScopes: string[] = [],
  options: ScopeCheckOptions = {}
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
    const { payload } = await jwtVerify(token, secret, {
      issuer: c.env.MCP_ISSUER,
    });

    const scopes = extractScopes(payload.scope ?? payload.scopes);

    const missingScope = requiredScopes.find((scope) => !scopes.includes(scope));

    if (missingScope) {
      throw new HTTPException(403, {
        res: c.json({ error: 'insufficient_scope', missing: missingScope }, 403),
      });
    }

    const auth: AuthContext = {
      userId: typeof payload.sub === 'string' ? payload.sub : null,
      scopes,
      token,
    };

    c.set('auth', auth);

    return auth;
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(401, {
      res: c.json({ error: 'invalid_token' }, 401),
    });
  }
};

export const requireScopes = (requiredScopes: string[] = []) =>
  createMiddleware<{ Bindings: Bindings; Variables: AppVariables }>(async (c, next) => {
    await authenticate(c, requiredScopes, { optional: false });
    await next();
  });

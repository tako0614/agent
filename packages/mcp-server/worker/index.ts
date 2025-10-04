import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registryRouter } from './routes/registry';
import { discoveryRouter } from './routes/discovery';
import { toolsRouter } from './routes/tools';
import { getPrisma } from './utils/prisma';
import type { AppVariables, Bindings } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use('*', cors({
  origin: (origin, c) => {
    const allowed =
      c.env.ALLOWED_ORIGINS?.split(',')
        .map((item: string) => item.trim())
        .filter(Boolean) ?? [];
    if (allowed.length === 0) {
      return '*';
    }
    if (!origin) return allowed[0] ?? '*';
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposeHeaders: ['WWW-Authenticate', 'X-Request-Id'],
}));

app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  c.set('prisma', getPrisma(c.env.DATABASE_URL));
  await next();
});

app.get('/healthz', (c) => c.json({ ok: true }));

app.get('/.well-known/openid-configuration', (c) => {
  const issuer = c.env.MCP_ISSUER || new URL(c.req.url).origin;

  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/auth/authorize`,
    token_endpoint: `${issuer}/auth/token`,
    jwks_uri: `${issuer}/auth/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: [
      'openid',
      'profile',
      'mcp.registry.read',
      'mcp.registry.write',
      'mcp.discovery.read',
      'agent.session.manage',
    ],
  });
});

app.get('/auth/jwks', (c) => c.json({ keys: [] }));

app.get('/auth/authorize', (c) =>
  c.json({ error: 'not_implemented', message: 'Authorization endpoint not yet implemented' }, 501)
);

app.post('/auth/token', (c) =>
  c.json({ error: 'not_implemented', message: 'Token endpoint not yet implemented' }, 501)
);

app.route('/mcp/registry', registryRouter);
app.route('/mcp/discovery', discoveryRouter);
app.route('/mcp/tools', toolsRouter);

export default {
  fetch: app.fetch,
};

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './auth';
import oauth from './oauth';
import mcp from './mcp';

type Bindings = {
  DATABASE_URL?: string;
  MCP_GOOGLE_CLIENT_ID?: string;
  MCP_GOOGLE_CLIENT_SECRET?: string;
  MCP_GOOGLE_REDIRECT_URI?: string;
  MCP_ISSUER?: string;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('/*', cors({
  origin: '*', // In production, set this to specific origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposeHeaders: ['WWW-Authenticate'], // Expose WWW-Authenticate for OAuth 2.1
}));

// Mount routes
app.route('/auth', auth);
app.route('/oauth', oauth);
app.route('/.well-known', oauth); // OAuth metadata endpoints
app.route('/mcp', mcp);

// Root endpoint
app.get('/', (c) => {
  const issuer = c.env.MCP_ISSUER || 'http://localhost:8788';
  
  return c.json({
    name: 'MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol Server with OAuth 2.1 Authentication',
    authentication: {
      type: 'OAuth 2.1',
      authorization_server: `${issuer}/.well-known/oauth-authorization-server`,
      protected_resource: `${issuer}/.well-known/oauth-protected-resource`,
      documentation: 'https://modelcontextprotocol.io/docs/specification/authentication'
    },
    endpoints: {
      auth: '/auth',
      oauth: '/oauth',
      mcp: '/mcp',
      health: '/health'
    }
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default {
  fetch: app.fetch,
};

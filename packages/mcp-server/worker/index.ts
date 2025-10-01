import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './auth';
import mcp from './mcp';

type Bindings = {
  DATABASE_URL?: string;
  MCP_GOOGLE_CLIENT_ID?: string;
  MCP_GOOGLE_CLIENT_SECRET?: string;
  MCP_GOOGLE_REDIRECT_URI?: string;
  AI_SERVICE_PUBLIC_KEY?: string;
  ALLOWED_ORIGINS?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('/*', cors({
  origin: (origin) => {
    const allowedOrigins = (c: any) => {
      const origins = c.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8787'];
      return origins.includes(origin) ? origin : origins[0];
    };
    return allowedOrigins;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Mount routes
app.route('/auth', auth);
app.route('/mcp', mcp);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'MCP Server',
    version: '0.1.0',
    description: 'Independent MCP tool API server',
    endpoints: {
      auth: '/auth',
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

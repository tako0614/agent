import { Hono } from 'hono';
import { cors } from 'hono/cors';
import api from './api';
import auth from './api/auth';

type Bindings = {
  DATABASE_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  LINE_CLIENT_ID?: string;
  LINE_CLIENT_SECRET?: string;
  LINE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  MCP_SERVER_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies
}));

// Mount sub-apps
app.route('/api', api);
app.route('/auth', auth);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'AI Service Builder API',
    version: '0.1.0',
    endpoints: {
      api: '/api',
      auth: '/auth',
      health: '/api/health'
    }
  });
});

export default {
  fetch: app.fetch,
};

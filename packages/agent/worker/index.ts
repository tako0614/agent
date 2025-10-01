import { Hono } from 'hono';
import { cors } from 'hono/cors';
import api from './api';
import auth from './api/auth';

type Bindings = {
  // Database
  DATABASE_URL?: string;
  
  // Payment
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  // AI
  OPENAI_API_KEY?: string;
  
  // OAuth 2.1 (MCP Server)
  MCP_SERVER_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI: string;
  OAUTH_SCOPE?: string;
  
  // Frontend
  FRONTEND_URL?: string;
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
    },
    oauth: {
      login: '/auth/login',
      callback: '/auth/callback',
      status: '/auth/status',
      logout: '/auth/logout'
    }
  });
});

export default {
  fetch: app.fetch,
};


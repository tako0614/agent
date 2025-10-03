import { Hono } from 'hono';
import { cors } from 'hono/cors';


const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: '*', // In production, set this to specific origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposeHeaders: ['WWW-Authenticate'], // Expose WWW-Authenticate for OAuth 2.1
}));

export default {
  fetch: app.fetch,
};

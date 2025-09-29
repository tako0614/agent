import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('/api/*', cors({
  origin: ['http://localhost:3000'],
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST'],
}));

// 基本のAPI
app.get('/api/hello', (c) => {
  return c.json({ 
    msg: 'Hello World!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (c) => {
  return c.json({ 
    status: 'ok',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

export default app;

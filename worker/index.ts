import { Hono } from "hono";

const app = new Hono();

app.get('/api/hello', (c) => {
  return c.json({ msg: 'Hello from Hono on Workers' });
});

app.all('*', (c) => {
  return c.text('Worker running. Use /api/hello for API.', 200);
});

export default app;

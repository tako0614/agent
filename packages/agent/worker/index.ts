import { Hono } from 'hono';
import api from './api';
import mcp from './mcp';

type Bindings = {

};

const app = new Hono<{ Bindings: Bindings }>();

// Mount sub-apps
app.route('/api', api);
app.route('/mcp', mcp);

export default app;

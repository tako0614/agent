import { Hono } from 'hono';
import { middleware } from './middleware';
import booking from './tools/booking';
import product from './tools/product';
import order from './tools/order';
import form from './tools/form';

type Bindings = {
  DATABASE_URL?: string;
  AI_SERVICE_PUBLIC_KEY?: string;
};

const mcp = new Hono<{ Bindings: Bindings }>();

// MCP API Overview
mcp.get('/', (c) => {
  return c.json({
    name: 'MCP Tools API',
    version: '1.0.0',
    description: 'Model Context Protocol tools for AI Service Builder',
    authentication: {
      aiService: 'Bearer token from AI Service',
      admin: 'MCP session cookie'
    },
    tools: [
      {
        name: 'booking',
        endpoint: '/mcp/tools/booking',
        description: 'Reservation and booking management'
      },
      {
        name: 'product',
        endpoint: '/mcp/tools/product',
        description: 'Product catalog management'
      },
      {
        name: 'order',
        endpoint: '/mcp/tools/order',
        description: 'Order processing and management'
      },
      {
        name: 'form',
        endpoint: '/mcp/tools/form',
        description: 'Dynamic form creation and submission'
      }
    ],
    documentation: 'https://github.com/tako0614/agent/blob/main/docs/guides/MCP_USAGE.md'
  });
});

// List all available tools
mcp.get('/tools', (c) => {
  return c.json({
    tools: [
      {
        name: 'booking_tool',
        description: 'Manage reservations and bookings',
        operations: ['available-slots', 'create', 'cancel', 'list', 'service/create'],
        endpoint: '/mcp/tools/booking'
      },
      {
        name: 'product_tool',
        description: 'Manage products and inventory',
        operations: ['search', 'get', 'create', 'update', 'delete'],
        endpoint: '/mcp/tools/product'
      },
      {
        name: 'order_tool',
        description: 'Process and manage orders',
        operations: ['create', 'get', 'list', 'update-status'],
        endpoint: '/mcp/tools/order'
      },
      {
        name: 'form_tool',
        description: 'Create and manage forms',
        operations: ['get', 'submit', 'create', 'list-submissions'],
        endpoint: '/mcp/tools/form'
      }
    ]
  });
});

// Mount tool routes with authentication middleware
mcp.route('/tools/booking', middleware(booking));
mcp.route('/tools/product', middleware(product));
mcp.route('/tools/order', middleware(order));
mcp.route('/tools/form', middleware(form));

export default mcp;

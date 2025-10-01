import { Hono } from 'hono';

import { publicEndpoint, requireAuth, requireAdmin, getCurrentUserId } from './middleware';

import accountRouter from './account';


type Bindings = {

  MCP_API_KEY?: string;
  DATABASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Mount account management routes
app.route('/account', accountRouter);

// MCP (Model Context Protocol) endpoints for AI agent tools
// These endpoints support multiple authentication methods:
// 1. Session cookie (for logged-in users)
// 2. API key (for external applications) 
// 3. Public access (for specific endpoints)

// ========================================
// BOOKING TOOLS
// ========================================

// [ADMIN] Create a booking service
app.post('/tools/booking/service/create', requireAdmin, async (c) => {
  const body = await c.req.json() as {
    name: string;
    description: string;
    duration: number;
    price: number;
  };
  
  const userId = getCurrentUserId(c);
  
  // TODO: Create booking service via database
  return c.json({
    success: true,
    data: {
      id: 'srv_' + Date.now(),
      message: `Booking service "${body.name}" created successfully`,
      service: body,
      createdBy: userId
    }
  });
});

// [PUBLIC] List available booking slots
app.get('/tools/booking/available-slots', publicEndpoint, async (c) => {
  const serviceId = c.req.query('serviceId');
  const date = c.req.query('date');
  
  // TODO: Query database for available slots
  return c.json({
    success: true,
    data: {
      slots: [
        { time: '09:00', available: true },
        { time: '10:00', available: false },
        { time: '11:00', available: true }
      ],
      serviceId,
      date
    }
  });
});

// [USER/AUTH] Create a booking
app.post('/tools/booking/create', requireAuth, async (c) => {
  const body = await c.req.json() as {
    serviceId: string;
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
  };
  
  const userId = getCurrentUserId(c);
  
  // TODO: Create booking via database
  return c.json({
    success: true,
    data: {
      id: 'bkg_' + Date.now(),
      message: 'Booking created successfully',
      booking: body,
      userId
    }
  });
});

// [USER/AUTH] Get booking details
app.get('/tools/booking/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const userId = getCurrentUserId(c);
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      serviceId: 'srv_1',
      date: '2025-10-15',
      time: '09:00',
      status: 'confirmed',
      userId
    }
  });
});

// [USER/AUTH] Cancel a booking
app.delete('/tools/booking/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const userId = getCurrentUserId(c);
  
  // TODO: Cancel booking in database
  return c.json({
    success: true,
    data: {
      message: `Booking ${id} cancelled`,
      userId
    }
  });
});

// [ADMIN] List all bookings for a service
app.get('/tools/booking/service/:serviceId/bookings', requireAdmin, async (c) => {
  const serviceId = c.req.param('serviceId');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      bookings: [],
      serviceId
    }
  });
});

// ========================================
// PRODUCT TOOLS
// ========================================

// [ADMIN] Create a new product
app.post('/tools/product/create', requireAdmin, async (c) => {
  const body = await c.req.json() as {
    name: string;
    description: string;
    price: number;
    stock: number;
  };
  
  const userId = getCurrentUserId(c);
  
  // TODO: Create product via database
  return c.json({
    success: true,
    data: {
      id: 'prd_' + Date.now(),
      message: `Product "${body.name}" created successfully`,
      product: body,
      createdBy: userId
    }
  });
});

// [PUBLIC] Search products
app.get('/tools/product/search', publicEndpoint, async (c) => {
  const query = c.req.query('q');
  const category = c.req.query('category');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      products: [],
      query,
      category
    }
  });
});

// [PUBLIC] Get product details
app.get('/tools/product/:id', publicEndpoint, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      name: 'Sample Product',
      price: 1000,
      stock: 10
    }
  });
});

// [PUBLIC] List all products
app.get('/tools/product/list', publicEndpoint, async (c) => {
  const limit = c.req.query('limit') || '20';
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      products: [],
      limit
    }
  });
});

// [ADMIN] Update product
app.put('/tools/product/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as {
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
  };
  
  // TODO: Update product in database
  return c.json({
    success: true,
    data: {
      id,
      message: 'Product updated successfully',
      updates: body
    }
  });
});

// [ADMIN] Delete product
app.delete('/tools/product/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Delete product from database
  return c.json({
    success: true,
    data: {
      message: `Product ${id} deleted`
    }
  });
});

// ========================================
// ORDER TOOLS
// ========================================

// [USER/AUTH] Create an order
app.post('/tools/order/create', requireAuth, async (c) => {
  const body = await c.req.json() as {
    items: Array<{ productId: string; quantity: number }>;
    shippingAddress: string;
  };
  
  const userId = getCurrentUserId(c);
  
  // TODO: Create order via database
  return c.json({
    success: true,
    data: {
      id: 'ord_' + Date.now(),
      message: 'Order created successfully',
      order: body,
      userId
    }
  });
});

// [USER/AUTH] Get order details
app.get('/tools/order/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const userId = getCurrentUserId(c);
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      status: 'processing',
      items: [],
      userId
    }
  });
});

// [USER/AUTH] List user's orders
app.get('/tools/order/user/list', requireAuth, async (c) => {
  const userId = getCurrentUserId(c);
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      orders: [],
      userId
    }
  });
});

// [USER/AUTH] Cancel an order
app.delete('/tools/order/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const userId = getCurrentUserId(c);
  
  // TODO: Cancel order in database
  return c.json({
    success: true,
    data: {
      message: `Order ${id} cancelled`,
      userId
    }
  });
});

// [ADMIN] List all orders
app.get('/tools/order/list', requireAdmin, async (c) => {
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      orders: []
    }
  });
});

// [ADMIN] Update order status
app.put('/tools/order/:id/status', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as {
    status: string;
  };
  
  // TODO: Update order status in database
  return c.json({
    success: true,
    data: {
      id,
      message: 'Order status updated',
      status: body.status
    }
  });
});

// ========================================
// FORM TOOLS
// ========================================

// [ADMIN] Create a new form
app.post('/tools/form/create', requireAdmin, async (c) => {
  const body = await c.req.json() as {
    title: string;
    description: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
  };
  
  const userId = getCurrentUserId(c);
  
  // TODO: Create form via database
  return c.json({
    success: true,
    data: {
      id: 'frm_' + Date.now(),
      message: `Form "${body.title}" created successfully`,
      form: body,
      createdBy: userId
    }
  });
});

// [PUBLIC] Get form details
app.get('/tools/form/:id', publicEndpoint, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      title: 'Sample Form',
      fields: []
    }
  });
});

// [PUBLIC] Submit a form
app.post('/tools/form/:id/submit', publicEndpoint, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const userId = getCurrentUserId(c); // May be null for anonymous submissions
  
  // TODO: Save submission to database
  return c.json({
    success: true,
    data: {
      submissionId: 'sub_' + Date.now(),
      message: 'Form submitted successfully',
      formId: id,
      userId
    }
  });
});

// [ADMIN] Get form submissions
app.get('/tools/form/:id/submissions', requireAdmin, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      submissions: [],
      formId: id
    }
  });
});

// [ADMIN] Get specific submission
app.get('/tools/form/submission/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      formId: 'frm_1',
      data: {}
    }
  });
});

// [ADMIN] List all forms
app.get('/tools/form/list', requireAdmin, async (c) => {
  // TODO: Query database
  return c.json({
    success: true,
    data: {
      forms: []
    }
  });
});

// [ADMIN] Update form
app.put('/tools/form/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as {
    title?: string;
    description?: string;
    fields?: Array<any>;
  };
  
  // TODO: Update form in database
  return c.json({
    success: true,
    data: {
      id,
      message: 'Form updated successfully',
      updates: body
    }
  });
});

// [ADMIN] Delete form
app.delete('/tools/form/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  
  // TODO: Delete form from database
  return c.json({
    success: true,
    data: {
      message: `Form ${id} deleted`
    }
  });
});

// Root endpoint with API documentation
app.get('/', (c) => {
  return c.json({
    name: 'MCP (Model Context Protocol) Server',
    version: '1.0.0',
    authentication: {
      methods: ['session_cookie', 'api_key', 'public'],
      description: 'Endpoints support multiple authentication methods based on access level'
    },
    endpoints: {
      account: {
        register: 'POST /mcp/account/register',
        me: 'GET /mcp/account/me',
        update: 'PUT /mcp/account/update',
        delete: 'DELETE /mcp/account/delete',
        list: 'GET /mcp/account/list (admin)',
        updateRole: 'PUT /mcp/account/:userId/role (admin)'
      },
      booking: {
        createService: 'POST /mcp/tools/booking/service/create (admin)',
        availableSlots: 'GET /mcp/tools/booking/available-slots (public)',
        create: 'POST /mcp/tools/booking/create (auth)',
        get: 'GET /mcp/tools/booking/:id (auth)',
        cancel: 'DELETE /mcp/tools/booking/:id (auth)',
        listByService: 'GET /mcp/tools/booking/service/:serviceId/bookings (admin)'
      },
      product: {
        create: 'POST /mcp/tools/product/create (admin)',
        search: 'GET /mcp/tools/product/search (public)',
        get: 'GET /mcp/tools/product/:id (public)',
        list: 'GET /mcp/tools/product/list (public)',
        update: 'PUT /mcp/tools/product/:id (admin)',
        delete: 'DELETE /mcp/tools/product/:id (admin)'
      },
      order: {
        create: 'POST /mcp/tools/order/create (auth)',
        get: 'GET /mcp/tools/order/:id (auth)',
        listUser: 'GET /mcp/tools/order/user/list (auth)',
        cancel: 'DELETE /mcp/tools/order/:id (auth)',
        listAll: 'GET /mcp/tools/order/list (admin)',
        updateStatus: 'PUT /mcp/tools/order/:id/status (admin)'
      },
      form: {
        create: 'POST /mcp/tools/form/create (admin)',
        get: 'GET /mcp/tools/form/:id (public)',
        submit: 'POST /mcp/tools/form/:id/submit (public)',
        submissions: 'GET /mcp/tools/form/:id/submissions (admin)',
        getSubmission: 'GET /mcp/tools/form/submission/:id (admin)',
        list: 'GET /mcp/tools/form/list (admin)',
        update: 'PUT /mcp/tools/form/:id (admin)',
        delete: 'DELETE /mcp/tools/form/:id (admin)'
      }
    }
  });
});

export default app;

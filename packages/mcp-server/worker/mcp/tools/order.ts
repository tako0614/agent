import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';

const order = new Hono<{ Variables: McpVariables }>();

// [USER] Create order
order.post('/create', requireScope('order:create'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { items, shippingAddress, billingAddress, paymentMethod } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'items array is required' }, 400);
  }

  // Calculate total
  const subtotal = items.reduce((sum: number, item: any) => {
    return sum + (item.price * item.quantity);
  }, 0);

  const tax = Math.round(subtotal * 0.1); // 10% tax
  const shipping = 500; // Fixed shipping cost
  const total = subtotal + tax + shipping;

  // TODO: Create order in database
  const orderId = `ord_${Date.now()}`;

  return c.json({
    success: true,
    data: {
      id: orderId,
      userId: auth.userId,
      items,
      subtotal,
      tax,
      shipping,
      total,
      shippingAddress,
      billingAddress,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
  });
});

// [USER] Get order details
order.get('/:id', requireScope('order:read'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  // TODO: Query database and verify ownership
  return c.json({
    success: true,
    data: {
      id,
      userId: auth.userId,
      items: [
        {
          productId: 'prd_001',
          name: 'Product 1',
          price: 2999,
          quantity: 2
        }
      ],
      subtotal: 5998,
      tax: 600,
      shipping: 500,
      total: 7098,
      status: 'shipped',
      trackingNumber: 'TRACK123456',
      createdAt: '2025-10-01T10:00:00Z',
      shippedAt: '2025-10-02T14:00:00Z'
    }
  });
});

// [USER] Get user's order history
order.get('/user/history', requireScope('order:read'), async (c) => {
  const auth = c.get('auth') as AuthContext;
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '20');

  // TODO: Query database for user's orders
  return c.json({
    success: true,
    data: {
      orders: [
        {
          id: 'ord_001',
          total: 7098,
          status: 'delivered',
          createdAt: '2025-09-15T10:00:00Z'
        },
        {
          id: 'ord_002',
          total: 3500,
          status: 'shipped',
          createdAt: '2025-10-01T10:00:00Z'
        }
      ],
      userId: auth.userId,
      filters: { status, limit }
    }
  });
});

// [USER] Cancel order
order.post('/:id/cancel', requireScope('order:cancel'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  // TODO: Cancel order in database (only if status allows)
  return c.json({
    success: true,
    message: `Order ${id} cancelled successfully`,
    data: {
      id,
      status: 'cancelled',
      cancelledBy: auth.userId,
      cancelledAt: new Date().toISOString()
    }
  });
});

// [ADMIN] List all orders
order.get('/', requireScope('order:admin'), async (c) => {
  const status = c.req.query('status');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');

  // TODO: Query database with filters and pagination
  return c.json({
    success: true,
    data: {
      orders: [
        {
          id: 'ord_001',
          userId: 'usr_001',
          customerName: 'John Doe',
          total: 7098,
          status: 'delivered',
          createdAt: '2025-09-15T10:00:00Z'
        },
        {
          id: 'ord_002',
          userId: 'usr_002',
          customerName: 'Jane Smith',
          total: 3500,
          status: 'shipped',
          createdAt: '2025-10-01T10:00:00Z'
        }
      ],
      pagination: {
        page,
        limit,
        total: 2,
        totalPages: 1
      },
      filters: { status }
    }
  });
});

// [ADMIN] Update order status
order.put('/:id/status', requireScope('order:admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { status, trackingNumber, notes } = body;

  if (!status) {
    return c.json({ error: 'status is required' }, 400);
  }

  // TODO: Update order status in database
  return c.json({
    success: true,
    message: `Order ${id} status updated to ${status}`,
    data: {
      id,
      status,
      trackingNumber,
      notes,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString()
    }
  });
});

export default order;

import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';
import type { PrismaClient, Prisma } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

type PrismaContext = PrismaClient | undefined;

function getPrisma(c: any): PrismaClient {
  const prisma = c.get('prisma') as PrismaContext;
  if (!prisma) {
    throw new Error('Database client not available');
  }
  return prisma;
}

function isAdmin(auth: AuthContext): boolean {
  const scopes = auth.scope || [];
  return scopes.includes('*') || scopes.includes('order:*') || scopes.includes('order:admin');
}

function ensureOrderAccess(order: { userId: string }, auth: AuthContext): boolean {
  return isAdmin(auth) || order.userId === auth.userId;
}

function calculateTotals(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.1);
  const shipping = subtotal > 0 ? 500 : 0;
  const total = subtotal + tax + shipping;
  return { subtotal, tax, shipping, total };
}

function normalizeStatus(status?: string | null): OrderStatus | undefined {
  if (!status) {
    return undefined;
  }
  const normalized = status.toUpperCase();
  if (Object.values(OrderStatus).includes(normalized as OrderStatus)) {
    return normalized as OrderStatus;
  }
  return undefined;
}

const order = new Hono<{ Variables: McpVariables }>();

// [USER] Create order
order.post('/create', requireScope('order:create'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { items, shippingAddress, billingAddress, paymentMethod } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'items array is required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== items.length) {
      return c.json({ error: 'One or more products could not be found' }, 400);
    }

    const orderItems = [] as Array<{ productId: string; quantity: number; price: number }>;
    for (const item of items) {
      if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return c.json({ error: 'Each item must include a productId and positive quantity' }, 400);
      }
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return c.json({ error: `Product ${item.productId} not found` }, 400);
      }
      const price = item.price ?? product.price;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price,
      });
    }

    const totals = calculateTotals(orderItems);

    const orderRecord = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        customerName: shippingAddress?.name || auth.user.name || 'Customer',
        customerEmail: auth.user.email,
        customerPhone: shippingAddress?.phone || null,
        totalAmount: totals.total,
        status: OrderStatus.PENDING,
        metadata: {
          shippingAddress: shippingAddress || null,
          billingAddress: billingAddress || null,
          paymentMethod: paymentMethod || null,
          subtotal: totals.subtotal,
          tax: totals.tax,
          shipping: totals.shipping,
        },
        userId: auth.userId,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    return c.json({
      success: true,
      data: {
        ...orderRecord,
        subtotal: totals.subtotal,
        tax: totals.tax,
        shipping: totals.shipping,
        total: totals.total,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create order' }, 500);
  }
});

// [USER] Get order details
order.get('/:id', requireScope('order:read'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);
    const orderRecord = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!orderRecord) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (!ensureOrderAccess(orderRecord, auth)) {
      return c.json({ error: 'You do not have access to this order' }, 403);
    }

    const metadata = (orderRecord.metadata as Record<string, any>) || {};

    return c.json({
      success: true,
      data: {
        ...orderRecord,
        items: orderRecord.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          productName: item.product?.name,
        })),
        subtotal: metadata.subtotal,
        tax: metadata.tax,
        shipping: metadata.shipping,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch order' }, 500);
  }
});

// [USER] Get user's order history
order.get('/user/history', requireScope('order:read'), async (c) => {
  const auth = c.get('auth') as AuthContext;
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const prisma = getPrisma(c);

    const where: Prisma.OrderWhereInput = {
      userId: auth.userId,
    };

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        orders: orders.map((orderRecord) => {
          const metadata = (orderRecord.metadata as Record<string, any>) || {};
          return {
            ...orderRecord,
            subtotal: metadata.subtotal,
            tax: metadata.tax,
            shipping: metadata.shipping,
          };
        }),
        pagination: {
          limit,
          offset,
          total,
        },
        filters: {
          status: normalizedStatus || null,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to load order history' }, 500);
  }
});

// [USER] Cancel order
order.post('/:id/cancel', requireScope('order:cancel'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json().catch(() => ({}));

  try {
    const prisma = getPrisma(c);
    const orderRecord = await prisma.order.findUnique({ where: { id } });

    if (!orderRecord) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (!ensureOrderAccess(orderRecord, auth)) {
      return c.json({ error: 'You do not have permission to cancel this order' }, 403);
    }

    if (![OrderStatus.PENDING, OrderStatus.PAID].includes(orderRecord.status)) {
      return c.json({ error: 'Order cannot be cancelled in its current status' }, 400);
    }

    const metadata = (orderRecord.metadata as Record<string, any>) || {};

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        metadata: {
          ...metadata,
          cancellationReason: body?.reason || null,
          cancelledBy: auth.userId,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    return c.json({
      success: true,
      message: `Order ${id} cancelled successfully`,
      data: updated,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to cancel order' }, 500);
  }
});

// [ADMIN] List all orders
order.get('/', requireScope('order:admin'), async (c) => {
  const status = c.req.query('status');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const userId = c.req.query('userId');

  const skip = Math.max(page - 1, 0) * limit;

  try {
    const prisma = getPrisma(c);
    const where: Prisma.OrderWhereInput = {};

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    if (userId) {
      where.userId = userId;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        orders: orders.map((orderRecord) => {
          const metadata = (orderRecord.metadata as Record<string, any>) || {};
          return {
            ...orderRecord,
            subtotal: metadata.subtotal,
            tax: metadata.tax,
            shipping: metadata.shipping,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        filters: {
          status: normalizedStatus || null,
          userId: userId || null,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list orders' }, 500);
  }
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

  try {
    const prisma = getPrisma(c);
    const normalizedStatus = normalizeStatus(status);

    if (!normalizedStatus) {
      return c.json({ error: 'Invalid order status' }, 400);
    }

    const existing = await prisma.order.findUnique({ where: { id } });

    if (!existing) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const metadata = {
      ...(existing.metadata as Record<string, any> | null | undefined),
      trackingNumber: trackingNumber || null,
      notes: notes || null,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    const orderRecord = await prisma.order.update({
      where: { id },
      data: {
        status: normalizedStatus,
        metadata,
      },
    });

    return c.json({
      success: true,
      message: `Order ${id} status updated to ${normalizedStatus}`,
      data: orderRecord,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update order status' }, 500);
  }
});

export default order;

import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';
import { PrismaClient, Prisma } from '@agent/database';

type PrismaContext = PrismaClient | undefined;

function getPrisma(c: any): PrismaClient {
  const prisma = c.get('prisma') as PrismaContext;
  if (!prisma) {
    throw new Error('Database client not available');
  }
  return prisma;
}

function parseCategory(metadata: any): string | undefined {
  if (metadata && typeof metadata === 'object') {
    return metadata.category || metadata.Category;
  }
  return undefined;
}

const product = new Hono<{ Variables: McpVariables }>();

// [PUBLIC] Search products
product.get('/search', async (c) => {
  const query = c.req.query('q');
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const serviceId = c.req.query('serviceId');

  try {
    const prisma = getPrisma(c);

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (category) {
      const existingAnd = where.AND;
      const categoryFilter = {
        metadata: {
          path: ['category'],
          equals: category,
        },
      };
      
      if (Array.isArray(existingAnd)) {
        where.AND = [...existingAnd, categoryFilter];
      } else if (existingAnd) {
        where.AND = [existingAnd, categoryFilter];
      } else {
        where.AND = [categoryFilter];
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        products: products.map((productRecord) => ({
          ...productRecord,
          category: parseCategory(productRecord.metadata),
        })),
        query: query || null,
        category: category || null,
        pagination: {
          limit,
          offset,
          total,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to search products' }, 500);
  }
});

// [PUBLIC] Get product details
product.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const prisma = getPrisma(c);
    const productRecord = await prisma.product.findUnique({ where: { id } });

    if (!productRecord) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...productRecord,
        category: parseCategory(productRecord.metadata),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch product' }, 500);
  }
});

// [ADMIN] Create product
product.post('/create', requireScope('product:admin'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { name, description, price, category, stock, images, serviceId, metadata } = body;

  if (!name || typeof price !== 'number') {
    return c.json({ error: 'name and numeric price are required' }, 400);
  }

  if (!serviceId) {
    return c.json({ error: 'serviceId is required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const productRecord = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price,
        stock: stock ?? 0,
        images: images || [],
        metadata: {
          ...(metadata || {}),
          category: category || (metadata ? metadata.category : undefined) || null,
          createdBy: auth.userId,
        },
        serviceId,
      },
    });

    return c.json({
      success: true,
      data: {
        ...productRecord,
        category: category || parseCategory(metadata),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create product' }, 500);
  }
});

// [ADMIN] Update product
product.put('/:id', requireScope('product:admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }

    let updatedMetadata = {
      ...(existing.metadata as Record<string, any> | null | undefined),
      ...(body.metadata || {}),
    } as Record<string, any> | undefined;

    if (body.category !== undefined) {
      if (!updatedMetadata) {
        updatedMetadata = {};
      }
      updatedMetadata.category = body.category;
    }

    const productRecord = await prisma.product.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        price: body.price ?? undefined,
        stock: body.stock ?? undefined,
        images: body.images ?? undefined,
        isActive: body.isActive ?? undefined,
        metadata: updatedMetadata ? { ...updatedMetadata, updatedBy: auth.userId } : undefined,
      },
    });

    return c.json({
      success: true,
      message: `Product ${id} updated successfully`,
      data: {
        ...productRecord,
        category: parseCategory(productRecord.metadata),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update product' }, 500);
  }
});

// [ADMIN] Delete product
product.delete('/:id', requireScope('product:admin'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const metadata = {
      ...(existing.metadata as Record<string, any> | null | undefined),
      deletedBy: auth.userId,
      deletedAt: new Date().toISOString(),
    };

    const productRecord = await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        metadata,
      },
    });

    return c.json({
      success: true,
      message: `Product ${id} deleted successfully`,
      data: {
        ...productRecord,
        category: parseCategory(productRecord.metadata),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete product' }, 500);
  }
});

// [ADMIN] List all products
product.get('/', requireScope('product:admin'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const serviceId = c.req.query('serviceId');
  const isActive = c.req.query('isActive');
  const skip = Math.max(page - 1, 0) * limit;

  try {
    const prisma = getPrisma(c);

    const where: Prisma.ProductWhereInput = {};

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive !== 'false';
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        products: products.map((productRecord) => ({
          ...productRecord,
          category: parseCategory(productRecord.metadata),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list products' }, 500);
  }
});

export default product;

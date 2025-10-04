import { Hono } from 'hono';
import { z } from 'zod';
import { McpAuthType, McpStatus, Prisma, type PrismaClient } from '@agent/database';
import type { AppVariables, Bindings } from '../types';
import { requireScopes } from '../utils/auth';
import { serializeMcpServer } from '../utils/serialization';

const listQuerySchema = z.object({
  tag: z.string().min(1).max(64).optional(),
  status: z.enum(Object.values(McpStatus) as [string, ...string[]]).optional(),
  owner: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const registerSchema = z.object({
  name: z.string().min(1).max(128),
  url: z.string().url(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(64)).max(32).default([]),
  authType: z.enum(Object.values(McpAuthType) as [string, ...string[]]).default(McpAuthType.NONE),
  ownerUserId: z.string().optional(),
});

const updateSchema = registerSchema
  .extend({
    id: z.string().min(1),
  status: z.enum(Object.values(McpStatus) as [string, ...string[]]).optional(),
  })
  .partial({ name: true, url: true, authType: true, description: true, tags: true, ownerUserId: true, status: true })
  .refine((data) => Object.keys(data).some((key) => key !== 'id'), {
    message: 'No fields provided to update',
    path: ['id'],
  });

const disableSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(512).optional(),
});

const generateServerId = (name: string) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 20) || 'mcp';

  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  return `${slug}-${random}`;
};

export const registryRouter = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

registryRouter.get('/list', requireScopes(['mcp.registry.read']), async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json({ error: 'invalid_query', details: parsed.error.flatten() }, 400);
  }

  const { tag, status, owner, cursor, limit } = parsed.data;
  const prisma = c.var.prisma;

  const servers = await prisma.mcpServer.findMany({
    where: {
      status: status ?? undefined,
      ownerUserId: owner ?? undefined,
      tags: tag
        ? {
            some: { tag },
          }
        : undefined,
    },
    include: { tags: true },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
  });

  const hasNext = servers.length > limit;
  const items = hasNext ? servers.slice(0, -1) : servers;

  return c.json({
    items: items.map(serializeMcpServer),
    nextCursor: hasNext ? items[items.length - 1]?.id : undefined,
  });
});

registryRouter.post('/register', requireScopes(['mcp.registry.write']), async (c) => {
  const payload = await c.req.json();
  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const prisma = c.var.prisma;
  const serverId = generateServerId(data.name);

  try {
    const server = await prisma.mcpServer.create({
      data: {
        id: serverId,
        name: data.name,
        url: data.url,
        description: data.description,
        authType: data.authType,
        ownerUserId: data.ownerUserId,
        tags: {
          create: data.tags.map((tag) => ({ tag })),
        },
      },
      include: { tags: true },
    });

    return c.json({ id: server.id, server: serializeMcpServer(server) }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return c.json({ error: 'duplicate_entry', target: error.meta?.target }, 409);
    }

    throw error;
  }
});

registryRouter.post('/update', requireScopes(['mcp.registry.write']), async (c) => {
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const { id, tags, ...rest } = parsed.data;
  const shouldUpdateTags = Object.prototype.hasOwnProperty.call(body, 'tags');
  const prisma = c.var.prisma;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(rest).length > 0) {
        await tx.mcpServer.update({
          where: { id },
          data: {
            ...rest,
          },
        });
      } else {
        await tx.mcpServer.findUniqueOrThrow({ where: { id } });
      }

      if (shouldUpdateTags) {
        await tx.mcpServerTag.deleteMany({ where: { mcpServerId: id } });
        if (tags && tags.length > 0) {
          await tx.mcpServerTag.createMany({
            data: tags.map((tag) => ({ mcpServerId: id, tag })),
          });
        }
      }

      return tx.mcpServer.findUniqueOrThrow({ include: { tags: true }, where: { id } });
    });

    return c.json({ ok: true, server: serializeMcpServer(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'not_found' }, 404);
    }

    throw error;
  }
});

registryRouter.post('/disable', requireScopes(['mcp.registry.write']), async (c) => {
  const body = await c.req.json();
  const parsed = disableSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;

  try {
    const server = await prisma.mcpServer.update({
      where: { id: parsed.data.id },
  data: { status: McpStatus.DISABLED },
      include: { tags: true },
    });

    return c.json({ ok: true, server: serializeMcpServer(server) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'not_found' }, 404);
    }

    throw error;
  }
});

registryRouter.get('/health/:id', requireScopes(['mcp.registry.read']), async (c) => {
  const id = c.req.param('id');
  const prisma = c.var.prisma;

  try {
    const server = await prisma.mcpServer.findUnique({ where: { id } });

    if (!server) {
      return c.json({ error: 'not_found' }, 404);
    }

    return c.json({
      status: server.status,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({ error: 'health_check_failed' }, 500);
  }
});

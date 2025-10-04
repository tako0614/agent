import { Hono } from 'hono';
import { z } from 'zod';
import { McpStatus, Prisma } from '@agent/database';
import type { AppVariables, Bindings } from '../types';
import { requireScopes } from '../utils/auth';
import { filterBuiltinServers } from '../utils/builtin';
import { serializeMcpServer } from '../utils/serialization';
import type { SerializedMcpServer } from '../utils/serialization';

const MAX_LIMIT = 100;

const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional(),
  tags: z
    .array(z.string().min(1).max(64))
    .max(32)
    .optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(20),
});

const suggestBodySchema = z
  .object({
    userContext: z.unknown().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .partial();

const normalizeTags = (raw: string[]): string[] =>
  raw
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

type DiscoveryCursor = {
  lastSource: 'builtin' | 'tenant';
  lastId: string;
};

const encodeCursor = (cursor: DiscoveryCursor): string => {
  const payload = JSON.stringify(cursor);

  if (typeof btoa === 'function') {
    return btoa(payload);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'utf-8').toString('base64');
  }

  return payload;
};

const decodeCursor = (raw: string | undefined): DiscoveryCursor | null => {
  if (!raw) {
    return null;
  }

  try {
    const json =
      typeof atob === 'function'
        ? atob(raw)
        : typeof Buffer !== 'undefined'
          ? Buffer.from(raw, 'base64').toString('utf-8')
          : raw;
    const parsed = JSON.parse(json) as DiscoveryCursor;

    if ((parsed.lastSource === 'builtin' || parsed.lastSource === 'tenant') && typeof parsed.lastId === 'string') {
      return parsed;
    }

    return null;
  } catch {
    // Fallback for legacy cursor that only sent tenant id
    return {
      lastSource: 'tenant',
      lastId: raw,
    };
  }
};

const extractPreferredTags = (userContext: unknown): string[] => {
  if (!userContext || typeof userContext !== 'object') {
    return [];
  }

  const candidate = (userContext as Record<string, unknown>).preferredTags ??
    (userContext as Record<string, unknown>).tags ??
    (userContext as Record<string, unknown>).recentTags;

  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return normalizeTags(candidate.map(String));
  }

  if (typeof candidate === 'string') {
    return normalizeTags([candidate]);
  }

  return [];
};

export const discoveryRouter = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

discoveryRouter.get('/search', requireScopes(['mcp.discovery.read']), async (c) => {
  const rawTags = c.req.queries('tags') ?? [];
  const singleTag = c.req.query('tags');
  const mergedTags = normalizeTags([
    ...rawTags,
    ...(singleTag ? [singleTag] : []),
  ]);

  const parsed = searchQuerySchema.safeParse({
    q: c.req.query('q') ?? undefined,
    tags: mergedTags.length > 0 ? mergedTags : undefined,
    cursor: c.req.query('cursor') ?? undefined,
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    return c.json({ error: 'invalid_query', details: parsed.error.flatten() }, 400);
  }

  const { q, tags, cursor, limit } = parsed.data;
  const parsedCursor = decodeCursor(cursor);
  const prisma = c.var.prisma;

  const where: Prisma.McpServerWhereInput = {
    status: McpStatus.ACTIVE,
  };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { tags: { some: { tag: { contains: q } } } },
    ];
  }

  if (tags && tags.length > 0) {
    where.tags = {
      some: { tag: { in: tags } },
    };
  }

  const builtinMatches = filterBuiltinServers(c.env, { q, tags }).map((server) => ({
    ...server,
    source: 'builtin' as const,
  }));

  const builtinStartIndex = (() => {
    if (!parsedCursor) {
      return 0;
    }

    if (parsedCursor.lastSource === 'tenant') {
      return builtinMatches.length;
    }

    const index = builtinMatches.findIndex((server) => server.id === parsedCursor.lastId);
    return index >= 0 ? index + 1 : builtinMatches.length;
  })();

  const remainingBuiltin = builtinMatches.slice(builtinStartIndex);
  const items: Array<SerializedMcpServer & { source: 'builtin' | 'tenant' }> = [];

  for (const server of remainingBuiltin) {
    if (items.length >= limit) {
      break;
    }
    items.push(server);
  }

  const remainingCapacity = limit - items.length;
  let hasMoreTenant = false;

  if (remainingCapacity > 0) {
    const tenantCursor = parsedCursor?.lastSource === 'tenant' ? parsedCursor.lastId : undefined;

    const tenantRecords = await prisma.mcpServer.findMany({
      where,
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
      take: remainingCapacity + 1,
      ...(tenantCursor
        ? {
            skip: 1,
            cursor: { id: tenantCursor },
          }
        : {}),
    });

    hasMoreTenant = tenantRecords.length > remainingCapacity;
    const selectedTenants = hasMoreTenant ? tenantRecords.slice(0, -1) : tenantRecords;

    for (const record of selectedTenants) {
      if (items.length >= limit) {
        break;
      }

      const serialized = serializeMcpServer(record);

      items.push({ ...serialized, source: 'tenant' });
    }

    if (hasMoreTenant && selectedTenants.length === 0) {
      hasMoreTenant = false;
    }
  }

  const includedBuiltinCount = items.filter((item) => item.source === 'builtin').length;
  const hasMoreBuiltin = remainingBuiltin.length > includedBuiltinCount;

  let nextCursorValue: string | undefined;

  if (hasMoreBuiltin) {
    const lastBuiltin = items
      .slice()
      .reverse()
      .find((item) => item.source === 'builtin');

    if (lastBuiltin) {
      nextCursorValue = encodeCursor({ lastSource: 'builtin', lastId: lastBuiltin.id });
    }
  } else if (hasMoreTenant) {
    const lastTenant = items
      .slice()
      .reverse()
      .find((item) => item.source === 'tenant');

    if (lastTenant) {
      nextCursorValue = encodeCursor({ lastSource: 'tenant', lastId: lastTenant.id });
    }
  }

  return c.json({
    items,
    nextCursor: nextCursorValue,
  });
});

discoveryRouter.post('/suggest', requireScopes(['mcp.discovery.read']), async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const parsed = suggestBodySchema.safeParse(payload ?? {});

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const limit = parsed.data.limit ?? 5;
  const preferredTags = parsed.data.userContext
    ? extractPreferredTags(parsed.data.userContext)
    : [];

  const prisma = c.var.prisma;
  const where: Prisma.McpServerWhereInput = {
    status: McpStatus.ACTIVE,
  };

  if (preferredTags.length > 0) {
    where.tags = {
      some: {
        tag: {
          in: preferredTags,
        },
      },
    };
  }

  const builtinSuggestions = filterBuiltinServers(c.env, {
    q: undefined,
    tags: preferredTags.length > 0 ? preferredTags : undefined,
  }).map((server) => ({ ...server, source: 'builtin' as const }));

  const items: Array<SerializedMcpServer & { source: 'builtin' | 'tenant' }> = [];

  for (const builtin of builtinSuggestions) {
    if (items.length >= limit) {
      break;
    }

    items.push(builtin);
  }

  const remainingCapacity = limit - items.length;

  if (remainingCapacity > 0) {
    const tenantServers = await prisma.mcpServer.findMany({
      where,
      include: { tags: true },
      orderBy: [
        { createdAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: remainingCapacity,
    });

    const seenIds = new Set(items.map((item) => item.id));

    for (const record of tenantServers) {
      if (items.length >= limit) {
        break;
      }

      if (seenIds.has(record.id)) {
        continue;
      }

      items.push({ ...serializeMcpServer(record), source: 'tenant' });
      seenIds.add(record.id);
    }
  }

  return c.json({ items });
});

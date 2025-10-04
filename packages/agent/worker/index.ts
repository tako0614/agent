import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { Prisma } from '@agent/database';
import type { AppVariables, Bindings } from './types';
import { getPrisma } from './utils/prisma';
import { requireAuth } from './utils/auth';
import {
  serializeAgentLink,
  serializeSessionWithMessages,
  serializeUser,
} from './utils/serialization';

const SCOPE_AGENT = 'agent.session.manage';

const searchSchema = z.object({
  query: z.string().trim().min(1).max(256),
  tags: z.array(z.string().min(1).max(64)).max(32).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
});

const linkSchema = z.object({
  mcpServerId: z.string().min(1),
  config: z.unknown().optional(),
});

const unlinkSchema = z.object({
  linkId: z.string().min(1),
  hardDelete: z.boolean().default(false),
});

const testSchema = z.object({
  mcpServerId: z.string().min(1),
  tool: z.string().min(1).optional(),
  args: z.unknown().optional(),
});

const chatSchema = z.object({
  sessionId: z.string().min(1).optional(),
  input: z.string().trim().min(1),
  stream: z.boolean().optional(),
});

const interruptSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().max(512).optional(),
});

const buildMcpUrl = (base: string, path: string, search?: URLSearchParams) => {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const pathname = path.startsWith('/') ? path : `/${path}`;
  const query = search && search.toString().length > 0 ? `?${search.toString()}` : '';
  return `${trimmed}${pathname}${query}`;
};

const pickServiceToken = (env: Bindings, fallback?: string) => {
  const candidate = env.MCP_SERVICE_TOKEN ?? fallback ?? '';
  const token = candidate.trim();
  return token.length > 0 ? token : null;
};

const asJsonObject = (value: unknown): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }

  return {};
};

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use('*', cors({
  origin: (origin, c) => {
    const allowed =
      c.env.ALLOWED_ORIGINS?.split(',')
        .map((item) => item.trim())
        .filter(Boolean) ?? [];
    if (allowed.length === 0) {
      return '*';
    }
    if (!origin) {
      return allowed[0];
    }
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposeHeaders: ['X-Request-Id'],
}));

app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  c.set('prisma', getPrisma(c.env.DATABASE_URL));
  await next();
});

app.get('/healthz', (c) => c.json({ ok: true }));

app.get('/api/user/me', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const user = await c.var.prisma.user.findUnique({ where: { id: auth.userId } });

  if (!user) {
    return c.json({ error: 'user_not_found' }, 404);
  }

  return c.json({ user: serializeUser(user) });
});

app.get('/api/mcp/linked', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const includeDisabled = c.req.query('includeDisabled');
  const shouldIncludeDisabled = includeDisabled === 'true';

  const links = await c.var.prisma.agentMcpLink.findMany({
    where: {
      userId: auth.userId,
      ...(shouldIncludeDisabled ? {} : { enabled: true }),
    },
    include: {
      server: { include: { tags: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({ items: links.map(serializeAgentLink) });
});

app.post('/api/mcp/search', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = searchSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const params = new URLSearchParams();
  params.set('q', parsed.data.query);
  if (parsed.data.limit) {
    params.set('limit', parsed.data.limit.toString());
  }
  if (parsed.data.cursor) {
    params.set('cursor', parsed.data.cursor);
  }
  for (const tag of parsed.data.tags ?? []) {
    params.append('tags', tag);
  }

  const serviceToken = pickServiceToken(c.env, auth.token);

  if (!serviceToken) {
    return c.json({ error: 'service_token_unavailable' }, 500);
  }

  const url = buildMcpUrl(c.env.MCP_SERVER_URL, '/mcp/discovery/search', params);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
    },
  });

  if (!response.ok) {
    return c.json({ error: 'discovery_request_failed', status: response.status }, 502);
  }

  const discovery = (await response.json()) as {
    items?: unknown[];
    nextCursor?: string;
  };

  return c.json({
    items: Array.isArray(discovery.items) ? discovery.items : [],
    source: 'discovery',
    nextCursor: discovery.nextCursor ?? null,
  });
});

app.post('/api/mcp/link', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = linkSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;
  const server = await prisma.mcpServer.findUnique({
    where: { id: parsed.data.mcpServerId },
    include: { tags: true },
  });

  if (!server) {
    return c.json({ error: 'server_not_found' }, 404);
  }

  const existing = await prisma.agentMcpLink.findUnique({
    where: {
      userId_mcpServerId: {
        userId: auth.userId,
        mcpServerId: parsed.data.mcpServerId,
      },
    },
    include: { server: { include: { tags: true } } },
  });

  if (existing) {
    const updated = await prisma.agentMcpLink.update({
      where: { id: existing.id },
      data: {
        enabled: true,
        ...(Object.prototype.hasOwnProperty.call(parsed.data, 'config')
          ? { configJson: (parsed.data.config ?? null) as Prisma.JsonValue | null }
          : {}),
      },
      include: { server: { include: { tags: true } } },
    });

    return c.json({ linkId: updated.id, link: serializeAgentLink(updated), restored: !existing.enabled });
  }

  const created = await prisma.agentMcpLink.create({
    data: {
      userId: auth.userId,
      mcpServerId: parsed.data.mcpServerId,
      enabled: true,
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'config')
        ? { configJson: (parsed.data.config ?? null) as Prisma.JsonValue | null }
        : {}),
    },
    include: { server: { include: { tags: true } } },
  });

  return c.json({ linkId: created.id, link: serializeAgentLink(created) }, 201);
});

app.post('/api/mcp/unlink', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = unlinkSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;
  const link = await prisma.agentMcpLink.findUnique({
    where: { id: parsed.data.linkId },
  });

  if (!link || link.userId !== auth.userId) {
    return c.json({ error: 'link_not_found' }, 404);
  }

  if (parsed.data.hardDelete) {
    await prisma.agentMcpLink.delete({ where: { id: link.id } });
    return c.json({ ok: true, deleted: true });
  }

  await prisma.agentMcpLink.update({
    where: { id: link.id },
    data: { enabled: false },
  });

  return c.json({ ok: true, disabled: true });
});

app.post('/api/mcp/test', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = testSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;
  const server = await prisma.mcpServer.findUnique({ where: { id: parsed.data.mcpServerId } });

  if (!server) {
    return c.json({ error: 'server_not_found' }, 404);
  }

  const serviceToken = pickServiceToken(c.env, auth.token);

  if (!serviceToken) {
    return c.json({ error: 'service_token_unavailable' }, 500);
  }

  const url = buildMcpUrl(c.env.MCP_SERVER_URL, `/mcp/registry/health/${encodeURIComponent(server.id)}`);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${serviceToken}` },
    });
    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return c.json({ ok: false, status: response.status, latencyMs }, 502);
    }

    const details = await response.json().catch(() => ({}));
    return c.json({ ok: true, latencyMs, details });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 502);
  }
});

app.post('/api/agent/chat', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  if (parsed.data.stream) {
    return c.json({ error: 'stream_not_supported' }, 400);
  }

  const prisma = c.var.prisma;
  let session = parsed.data.sessionId
    ? await prisma.agentSession.findUnique({ where: { id: parsed.data.sessionId } })
    : null;

  if (session && session.userId !== auth.userId) {
    return c.json({ error: 'session_not_found' }, 404);
  }

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        userId: auth.userId,
        graphState: {
          history: [],
          createdAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });
  }

  await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: parsed.data.input,
    },
  });

  const replyContent = `Echo: ${parsed.data.input}`;

  await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'assistant',
      content: replyContent,
      metadata: {
        kind: 'echo',
      } as Prisma.JsonValue,
    },
  });

  const graphState: Prisma.JsonObject = {
    ...asJsonObject(session.graphState),
    lastInput: parsed.data.input,
    lastReply: replyContent,
    updatedAt: new Date().toISOString(),
  };

  await prisma.agentSession.update({
    where: { id: session.id },
    data: { graphState },
  });

  const sessionWithMessages = await prisma.agentSession.findUnique({
    where: { id: session.id },
    include: { messages: true },
  });

  if (!sessionWithMessages || sessionWithMessages.userId !== auth.userId) {
    throw new HTTPException(500, {
      res: c.json({ error: 'session_refresh_failed' }, 500),
    });
  }

  const { session: serializedSession, messages } = serializeSessionWithMessages(sessionWithMessages);
  const responseMessage = messages[messages.length - 1] ?? null;

  return c.json({
    sessionId: serializedSession.id,
    session: serializedSession,
    messages,
    response: responseMessage,
  });
});

app.get('/api/agent/state/:sessionId', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const sessionId = c.req.param('sessionId');

  const sessionWithMessages = await c.var.prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });

  if (!sessionWithMessages || sessionWithMessages.userId !== auth.userId) {
    return c.json({ error: 'session_not_found' }, 404);
  }

  return c.json(serializeSessionWithMessages(sessionWithMessages));
});

app.post('/api/agent/interrupt', requireAuth([SCOPE_AGENT]), async (c) => {
  const auth = c.var.auth;

  if (!auth) {
    throw new HTTPException(500, {
      res: c.json({ error: 'auth_context_missing' }, 500),
    });
  }

  const payload = await c.req.json().catch(() => ({}));
  const parsed = interruptSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;
  const session = await prisma.agentSession.findUnique({ where: { id: parsed.data.sessionId } });

  if (!session || session.userId !== auth.userId) {
    return c.json({ error: 'session_not_found' }, 404);
  }

  const checkpoint: Prisma.JsonObject = {
    ...asJsonObject(session.checkpoint),
    interruptedAt: new Date().toISOString(),
    reason: parsed.data.reason ?? null,
  };

  const graphState: Prisma.JsonObject = {
    ...asJsonObject(session.graphState),
    status: 'interrupted',
  };

  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      checkpoint,
      graphState,
    },
  });

  return c.json({ ok: true });
});

export default {
  fetch: app.fetch,
};

import { Hono } from 'hono';
import { z } from 'zod';
import { McpAuthType, McpStatus } from '@agent/database';
import type { AppVariables, Bindings } from '../types';
import { requireScopes } from '../utils/auth';

const invokeSchema = z.object({
  args: z.unknown().optional(),
  sessionId: z.string().min(1).optional(),
});

export const toolsRouter = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

toolsRouter.post('/:id/:toolName', requireScopes(['mcp.registry.read']), async (c) => {
  const { id, toolName } = c.req.param();
  const payload = await c.req.json().catch(() => ({}));
  const parsed = invokeSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const prisma = c.var.prisma;
  const server = await prisma.mcpServer.findUnique({ where: { id } });

  if (!server) {
    return c.json({ error: 'server_not_found' }, 404);
  }

  if (server.status !== McpStatus.ACTIVE) {
    return c.json({ error: 'server_inactive', status: server.status }, 409);
  }

  if (server.authType !== McpAuthType.NONE) {
    return c.json({ error: 'unsupported_auth_type', authType: server.authType }, 501);
  }

  const baseUrl = server.url.endsWith('/') ? server.url.slice(0, -1) : server.url;
  const target = `${baseUrl}/tools/${encodeURIComponent(toolName)}`;
  const started = Date.now();

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        args: parsed.data.args ?? {},
        sessionId: parsed.data.sessionId,
      }),
    });

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      const bodyText = await response.text();
      return c.json({
        error: 'tool_invocation_failed',
        status: response.status,
        latencyMs,
        body: bodyText,
      }, 502);
    }

    const result = await response.json().catch(() => ({}));

    return c.json({
      ok: true,
      latencyMs,
      result,
    });
  } catch (error) {
    return c.json({
      error: 'tool_request_error',
      message: (error as Error).message,
    }, 502);
  }
});

import './polyfills';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import { SignJWT } from 'jose';
import { HumanMessage } from '@langchain/core/messages';
import type { AppVariables, Bindings } from './types';
import { getPrisma } from './utils/prisma';
import { requireAuth } from './utils/auth';
import {
  serializeAgentLink,
  serializeSessionWithMessages,
  serializeUser,
} from './utils/serialization';
import { createAgentGraph } from './graph';

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

const asJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use('*', cors({
  origin: (origin, c) => {
    const allowed =
      c.env.ALLOWED_ORIGINS?.split(',')
        .map((item: string) => item.trim())
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
  c.set('prisma', getPrisma(c.env.DB));
  await next();
});

app.get('/healthz', (c) => c.json({ ok: true }));

// Google OAuth ログインエンドポイント
app.get('/auth/google', async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = c.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return c.json({ error: 'google_oauth_not_configured' }, 500);
  }

  const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  // ステートとコードベリファイアをCookieに保存
  const response = c.redirect(url.toString());
  response.headers.append('Set-Cookie', `google_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  response.headers.append('Set-Cookie', `google_code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  return response;
});

// Google OAuth コールバックエンドポイント
app.get('/auth/callback/google', async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET, MCP_ISSUER } = c.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return c.json({ error: 'google_oauth_not_configured' }, 500);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'missing_code_or_state' }, 400);
  }

  // Cookieから状態とコードベリファイアを取得
  const cookies = c.req.header('cookie') || '';
  console.log('Received cookies:', cookies);
  console.log('Received state from URL:', state);
  
  const cookieMap = new Map(
    cookies.split(';').map(cookie => {
      const [key, value] = cookie.trim().split('=');
      return [key, value];
    })
  );

  const savedState = cookieMap.get('google_oauth_state');
  const codeVerifier = cookieMap.get('google_code_verifier');

  console.log('Saved state from cookie:', savedState);
  console.log('Code verifier from cookie:', codeVerifier);

  if (!savedState || !codeVerifier) {
    return c.json({ 
      error: 'missing_cookies',
      details: { savedState: !!savedState, codeVerifier: !!codeVerifier },
      cookies: cookies 
    }, 400);
  }

  if (savedState !== state) {
    return c.json({ 
      error: 'invalid_state',
      details: { expected: savedState, received: state }
    }, 400);
  }

  try {
    const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);

    const accessToken = tokens.accessToken();
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;

    // refresh_tokenは初回認証時のみ提供される
    try {
      refreshToken = tokens.refreshToken();
    } catch (e) {
      console.log('No refresh token available (this is normal for subsequent logins)');
    }

    try {
      expiresAt = tokens.accessTokenExpiresAt();
    } catch (e) {
      console.log('No expiry time available');
    }

    // GoogleのユーザーInfo APIを呼び出す
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json() as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    // ユーザーをデータベースに保存または更新
    const prisma = c.var.prisma;
    
    let user = await prisma.user.findFirst({
      where: {
        accounts: {
          some: {
            provider: 'google',
            providerAccountId: userInfo.sub,
          },
        },
      },
    });

    if (!user) {
      // 新規ユーザーを作成
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          displayName: userInfo.name || userInfo.email.split('@')[0],
          accounts: {
            create: {
              provider: 'google',
              providerAccountId: userInfo.sub,
              accessToken,
              refreshToken,
              expiresAt,
            },
          },
        },
      });
    } else {
      // 既存ユーザーのトークンを更新
      await prisma.oAuthAccount.updateMany({
        where: {
          userId: user.id,
          provider: 'google',
        },
        data: {
          accessToken,
          refreshToken,
          expiresAt,
        },
      });
    }

    // JWTを生成
    const encoder = new TextEncoder();
    const secret = encoder.encode(JWT_SECRET);
    const issuer = MCP_ISSUER || 'agent-worker';
    
    console.log('Generating JWT with issuer:', issuer);
    
    const jwt = await new SignJWT({
      sub: user.id,
      email: user.email,
      scope: 'agent.session.manage mcp.discovery.read',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    console.log('JWT generated successfully for user:', user.id, user.email);
    console.log('JWT token (first 20 chars):', jwt.substring(0, 20));

    // フロントエンドにリダイレクトしてトークンを渡す
    const redirectUrl = new URL('/', c.req.url);
    redirectUrl.searchParams.set('token', jwt);

    console.log('Redirecting to:', redirectUrl.toString().substring(0, 100));

    // Cookieをクリア
    const redirectResponse = c.redirect(redirectUrl.toString());
    redirectResponse.headers.append('Set-Cookie', `google_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    redirectResponse.headers.append('Set-Cookie', `google_code_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

    return redirectResponse;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return c.json({ error: 'oauth_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

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
          ? { configJson: parsed.data.config ? JSON.stringify(parsed.data.config) : null }
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
        ? { configJson: parsed.data.config ? JSON.stringify(parsed.data.config) : null }
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

  // Validate OpenAI API key
  const openaiApiKey = c.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return c.json({ error: 'openai_api_key_not_configured' }, 500);
  }

  const prisma = c.var.prisma;
  let session = parsed.data.sessionId
    ? await prisma.agentSession.findUnique({ where: { id: parsed.data.sessionId }, include: { messages: true } })
    : null;

  if (session && session.userId !== auth.userId) {
    return c.json({ error: 'session_not_found' }, 404);
  }

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        userId: auth.userId,
        graphState: JSON.stringify({
          messages: [],
          createdAt: new Date().toISOString(),
        }),
      },
      include: { messages: true },
    });
  }

  // Save user message
  await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: parsed.data.input,
    },
  });

  try {
    // Build MCP base URL
    const mcpBaseUrl = c.env.MCP_BASE_URL || 'http://localhost:8788';
    const serviceToken = pickServiceToken(c.env);

    // Create LangGraph agent
    const graph = createAgentGraph({
      prisma,
      userId: auth.userId,
      openaiApiKey,
      mcpBaseUrl,
      serviceToken,
    });

    // Restore previous messages from session
    const previousMessages = session.messages.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new HumanMessage(msg.content); // Will be replaced with AIMessage when properly structured
      }
      return new HumanMessage(msg.content);
    });

    // Add new user message
    previousMessages.push(new HumanMessage(parsed.data.input));

    // Invoke graph
    const graphState = await graph.invoke({
      messages: previousMessages,
    });

    // Extract assistant response
    const lastMessage = graphState.messages[graphState.messages.length - 1];
    const assistantContent = lastMessage?.content?.toString() || 'No response generated';

    // Save assistant message
    const assistantMessage = await prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
        metadata: JSON.stringify({
          kind: 'langgraph',
          messageCount: graphState.messages.length,
        }),
      },
    });

    // Update session state
    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        graphState: JSON.stringify({
          messageCount: graphState.messages.length,
          lastUpdated: new Date().toISOString(),
        }),
      },
    });

    // Fetch updated session
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

    return c.json({
      sessionId: serializedSession.id,
      session: serializedSession,
      messages,
      response: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Agent chat error:', error);

    // Save error message
    await prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        metadata: JSON.stringify({
          kind: 'error',
          error: (error as Error).message,
        }),
      },
    });

    return c.json({ error: 'agent_execution_failed', details: (error as Error).message }, 500);
  }
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

  const checkpoint = {
    ...asJsonObject(session.checkpoint),
    interruptedAt: new Date().toISOString(),
    reason: parsed.data.reason ?? null,
  };

  const graphState = {
    ...asJsonObject(session.graphState),
    status: 'interrupted',
  };

  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      checkpoint: JSON.stringify(checkpoint),
      graphState: JSON.stringify(graphState),
    },
  });

  return c.json({ ok: true });
});

export default {
  fetch: app.fetch,
};

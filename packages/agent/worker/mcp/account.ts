import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { createAuthService } from '../auth';

type Bindings = {
  DATABASE_URL?: string;
  MCP_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * MCP Account Management Tools
 * These endpoints allow external users to create and manage accounts via MCP protocol
 */

// ========================================
// PUBLIC ACCOUNT ENDPOINTS
// ========================================

/**
 * Create a new account
 * Can be called by external MCP clients
 */
app.post('/account/register', async (c) => {
  const body = await c.req.json() as {
    email: string;
    name: string;
    password?: string; // Optional for OAuth users
    provider?: 'google' | 'line' | 'email';
    providerId?: string;
  };

  // Validate input
  if (!body.email || !body.name) {
    return c.json({ error: 'Email and name are required' }, 400);
  }

  // TODO: Create user in database
  // const user = await prisma.user.create({
  //   data: {
  //     email: body.email,
  //     name: body.name,
  //     provider: body.provider || 'email',
  //     providerId: body.providerId || body.email,
  //     password: body.password ? await hashPassword(body.password) : undefined
  //   }
  // });

  const mockUser = {
    id: `user_${Date.now()}`,
    email: body.email,
    name: body.name,
    provider: body.provider || 'email',
    createdAt: new Date().toISOString()
  };

  // Create session for new user
  const authService = createAuthService({});
  const sessionToken = authService.createSessionToken(mockUser.id);

  // Set session cookie
  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return c.json({
    success: true,
    data: {
      user: mockUser,
      message: 'Account created successfully'
    }
  });
});

/**
 * Get account information
 * Requires authentication (session or API key)
 */
app.get('/account/me', async (c) => {
  // Check authentication
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                       c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

  if (!sessionToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // TODO: Get user from database
  // const user = await prisma.user.findUnique({
  //   where: { id: session.userId }
  // });

  const mockUser = {
    id: session.userId,
    email: 'user@example.com',
    name: 'User Name',
    provider: 'email',
    createdAt: new Date().toISOString()
  };

  return c.json({
    success: true,
    data: mockUser
  });
});

/**
 * Update account information
 * Requires authentication
 */
app.put('/account/update', async (c) => {
  // Check authentication
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                       c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

  if (!sessionToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  const body = await c.req.json() as {
    name?: string;
    email?: string;
  };

  // TODO: Update user in database
  // const user = await prisma.user.update({
  //   where: { id: session.userId },
  //   data: body
  // });

  return c.json({
    success: true,
    data: {
      message: 'Account updated successfully',
      userId: session.userId,
      updates: body
    }
  });
});

/**
 * Delete account
 * Requires authentication
 */
app.delete('/account/delete', async (c) => {
  // Check authentication
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                       c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

  if (!sessionToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // TODO: Delete user and all related data from database
  // await prisma.user.delete({
  //   where: { id: session.userId }
  // });

  return c.json({
    success: true,
    data: {
      message: 'Account deleted successfully'
    }
  });
});

// ========================================
// ADMIN ACCOUNT ENDPOINTS (API Key required)
// ========================================

/**
 * List all accounts (admin only)
 */
app.get('/account/list', async (c) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.env.MCP_API_KEY;
  
  // Require API key for admin access
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  // TODO: Query database
  // const users = await prisma.user.findMany({
  //   skip: (page - 1) * limit,
  //   take: limit
  // });

  const mockUsers = [
    {
      id: 'user_1',
      email: 'user1@example.com',
      name: 'User One',
      provider: 'google',
      createdAt: new Date().toISOString()
    }
  ];

  return c.json({
    success: true,
    data: {
      users: mockUsers,
      page,
      limit,
      total: mockUsers.length
    }
  });
});

/**
 * Update user role (admin only)
 */
app.put('/account/:userId/role', async (c) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.env.MCP_API_KEY;
  
  // Require API key for admin access
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const userId = c.req.param('userId');
  const body = await c.req.json() as {
    role: 'user' | 'admin';
  };

  // TODO: Update user role in database
  // const user = await prisma.user.update({
  //   where: { id: userId },
  //   data: { role: body.role }
  // });

  return c.json({
    success: true,
    data: {
      message: `User ${userId} role updated to ${body.role}`,
      userId,
      role: body.role
    }
  });
});

/**
 * Delete user account (admin only)
 */
app.delete('/account/:userId', async (c) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.env.MCP_API_KEY;
  
  // Require API key for admin access
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const userId = c.req.param('userId');

  // TODO: Delete user from database
  // await prisma.user.delete({
  //   where: { id: userId }
  // });

  return c.json({
    success: true,
    data: {
      message: `User ${userId} deleted successfully`
    }
  });
});

export default app;

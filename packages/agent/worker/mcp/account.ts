import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { createAuthService } from '../auth';
import { publicEndpoint, requireAuth, getCurrentUserId } from './middleware';

type Bindings = {
  DATABASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * MCP Account Management Tools
 * These endpoints allow AI agents to create and manage user accounts
 */

// ========================================
// PUBLIC ACCOUNT TOOL ENDPOINTS
// ========================================

/**
 * Create a new account
 * [PUBLIC] Can be called by AI agents to register users
 */
app.post('/register', publicEndpoint, async (c) => {
  const body = await c.req.json() as {
    email: string;
    name: string;
    password?: string;
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
    provider: body.provider || 'email' as const,
    picture: undefined,
    createdAt: new Date().toISOString()
  };

  // Create session for new user
  const authService = createAuthService({});
  const sessionToken = authService.createSessionToken(mockUser);

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
      sessionToken,
      message: 'Account created successfully'
    }
  });
});

/**
 * Get account information
 * [AUTH] Requires authentication
 */
app.get('/me', requireAuth, async (c) => {
  const userId = getCurrentUserId(c);

  if (!userId) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TODO: Get user from database
  // const user = await prisma.user.findUnique({
  //   where: { id: userId }
  // });

  const sessionToken = getCookie(c, 'session');
  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken || '');

  const mockUser = {
    id: userId,
    email: session?.email || 'user@example.com',
    name: session?.name || 'User Name',
    provider: session?.provider || 'email',
    picture: session?.picture,
    createdAt: new Date().toISOString()
  };

  return c.json({
    success: true,
    data: mockUser
  });
});

/**
 * Update account information
 * [AUTH] Requires authentication
 */
app.put('/update', requireAuth, async (c) => {
  const userId = getCurrentUserId(c);

  if (!userId) {
    return c.json({ error: 'User not found' }, 404);
  }

  const body = await c.req.json() as {
    name?: string;
    email?: string;
  };

  // TODO: Update user in database
  // const user = await prisma.user.update({
  //   where: { id: userId },
  //   data: body
  // });

  return c.json({
    success: true,
    data: {
      message: 'Account updated successfully',
      userId,
      updates: body
    }
  });
});

/**
 * Delete account
 * [AUTH] Requires authentication
 */
app.delete('/delete', requireAuth, async (c) => {
  const userId = getCurrentUserId(c);

  if (!userId) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TODO: Delete user and all related data from database
  // await prisma.user.delete({
  //   where: { id: userId }
  // });

  // Clear session cookie
  setCookie(c, 'session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  });

  return c.json({
    success: true,
    data: {
      message: 'Account deleted successfully'
    }
  });
});

/**
 * Login with email and password
 * [PUBLIC] Can be called by AI agents to authenticate users
 */
app.post('/login', publicEndpoint, async (c) => {
  const body = await c.req.json() as {
    email: string;
    password: string;
  };

  // Validate input
  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // TODO: Verify credentials from database
  // const user = await prisma.user.findUnique({
  //   where: { email: body.email }
  // });
  // if (!user || !await verifyPassword(body.password, user.password)) {
  //   return c.json({ error: 'Invalid credentials' }, 401);
  // }

  const mockUser = {
    id: `user_${Date.now()}`,
    email: body.email,
    name: 'User Name',
    provider: 'email' as const,
    picture: undefined,
  };

  // Create session
  const authService = createAuthService({});
  const sessionToken = authService.createSessionToken(mockUser);

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
      sessionToken,
      message: 'Login successful'
    }
  });
});

/**
 * Logout
 * [AUTH] Requires authentication
 */
app.post('/logout', requireAuth, async (c) => {
  // Clear session cookie
  setCookie(c, 'session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  });

  return c.json({
    success: true,
    data: {
      message: 'Logout successful'
    }
  });
});

export default app;

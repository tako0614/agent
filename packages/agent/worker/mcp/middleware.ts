import { Context } from 'hono';
import { getCookie } from 'hono/cookie';

export async function authenticateMCP(c: Context, next: () => Promise<void>, options?: {
  requireAuth?: boolean;
  adminOnly?: boolean;
}) {
  const { requireAuth = false, adminOnly = false } = options || {};
  
  let userId: string | null = null;
  let isAdmin = false;
  let authMethod: 'oauth' | 'session' | 'none' = 'none';

  const accessToken = getCookie(c, 'access_token');
  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub || payload.userId;
        authMethod = 'oauth';
      }
    } catch (e) {
      console.error('Failed to parse JWT token:', e);
    }
  }
  
  if (!userId) {
    const sessionToken = getCookie(c, 'session');
    if (sessionToken) {
      authMethod = 'session';
      userId = 'legacy-user';
    }
  }

  if (requireAuth && !userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (adminOnly && !isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  c.set('userId', userId);
  c.set('isAdmin', isAdmin);
  c.set('authMethod', authMethod);

  await next();
}

export async function publicEndpoint(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: false });
}

export async function requireAuth(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true });
}

export async function requireAdmin(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true, adminOnly: true });
}

export function getCurrentUserId(c: Context): string | null {
  return c.get('userId') || null;
}

export function isAdmin(c: Context): boolean {
  return c.get('isAdmin') || false;
}

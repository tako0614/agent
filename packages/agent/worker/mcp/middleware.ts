import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { createAuthService } from '../auth';

/**
 * MCP Authentication middleware
 * Supports authentication methods:
 * 1. Session cookie (for logged-in users)
 * 2. Public access (for specific endpoints)
 */
export async function authenticateMCP(c: Context, next: () => Promise<void>, options?: {
  requireAuth?: boolean;
  adminOnly?: boolean;
}) {
  const { requireAuth = false, adminOnly = false } = options || {};
  
  let userId: string | null = null;
  let isAdmin = false;
  let authMethod: 'session' | 'none' = 'none';

  // Check session cookie
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    const authService = createAuthService({});
    const session = authService.validateSessionToken(sessionToken);
    
    if (session) {
      userId = session.id;
      authMethod = 'session';
      
      // TODO: Check if user is admin from database
      // For now, treat all authenticated users as non-admin
      // isAdmin = await checkUserIsAdmin(userId);
    }
  }

  // Check authentication requirements
  if (requireAuth && !userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (adminOnly && !isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Store auth info in context
  c.set('userId', userId);
  c.set('isAdmin', isAdmin);
  c.set('authMethod', authMethod);

  await next();
}

/**
 * Middleware for public endpoints (no auth required)
 */
export async function publicEndpoint(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: false });
}

/**
 * Middleware for authenticated endpoints (session required)
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true });
}

/**
 * Middleware for admin-only endpoints
 */
export async function requireAdmin(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true, adminOnly: true });
}

/**
 * Helper to get current user ID from context
 */
export function getCurrentUserId(c: Context): string | null {
  return c.get('userId') as string | null;
}

/**
 * Helper to check if current user is admin
 */
export function isCurrentUserAdmin(c: Context): boolean {
  return c.get('isAdmin') as boolean;
}

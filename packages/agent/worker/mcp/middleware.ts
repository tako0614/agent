import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { createAuthService } from '../auth';

/**
 * MCP Authentication middleware
 * Supports multiple authentication methods:
 * 1. Session cookie (for logged-in users)
 * 2. API key (for external applications)
 * 3. Public access (for specific endpoints)
 */
export async function authenticateMCP(c: Context, next: () => Promise<void>, options?: {
  requireAuth?: boolean;
  allowApiKey?: boolean;
  adminOnly?: boolean;
}) {
  const { requireAuth = false, allowApiKey = true, adminOnly = false } = options || {};
  
  let userId: string | null = null;
  let isAdmin = false;
  let authMethod: 'session' | 'apikey' | 'none' = 'none';

  // 1. Check session cookie
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    const authService = createAuthService({});
    const session = authService.validateSessionToken(sessionToken);
    
    if (session) {
      userId = session.userId;
      authMethod = 'session';
      
      // TODO: Check if user is admin from database
      // For now, treat all authenticated users as non-admin
      // isAdmin = await checkUserIsAdmin(userId);
    }
  }

  // 2. Check API key (for external applications)
  if (!userId && allowApiKey) {
    const authHeader = c.req.header('Authorization');
    const apiKey = c.env.MCP_API_KEY;
    
    if (apiKey && authHeader === `Bearer ${apiKey}`) {
      // API key authentication grants admin access
      isAdmin = true;
      authMethod = 'apikey';
    }
  }

  // 3. Check authentication requirements
  if (requireAuth && !userId && !isAdmin) {
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
  await authenticateMCP(c, next, { requireAuth: false, allowApiKey: true });
}

/**
 * Middleware for authenticated endpoints (session or API key required)
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true, allowApiKey: true });
}

/**
 * Middleware for admin-only endpoints
 */
export async function requireAdmin(c: Context, next: () => Promise<void>) {
  await authenticateMCP(c, next, { requireAuth: true, allowApiKey: true, adminOnly: true });
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

import { MiddlewareHandler } from 'hono';
import { verifyAiServiceToken, hasScope } from '../auth/verify';

/**
 * Authentication middleware for MCP tools
 * Supports both AI Service tokens and MCP admin sessions
 */
export function middleware(handler: any): any {
  const app = handler;

  // Apply auth middleware to all routes
  app.use('/*', async (c: any, next: any) => {
    // Check for AI Service token
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const publicKey = c.env.AI_SERVICE_PUBLIC_KEY || '';
        const payload = await verifyAiServiceToken(token, publicKey);
        
        // Set user context from token
        c.set('auth', {
          type: 'ai-service',
          userId: payload.sub,
          scope: payload.scope,
          user: payload.user
        });
        
        await next();
        return;
      } catch (error) {
        return c.json({ error: 'Invalid token' }, 401);
      }
    }

    // Check for MCP admin session
    const cookies = c.req.header('Cookie');
    const sessionCookie = cookies?.split(';').find((c: string) => c.trim().startsWith('mcp_session='));
    
    if (sessionCookie) {
      try {
        const sessionToken = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(atob(sessionToken));
        
        // Set admin context
        c.set('auth', {
          type: 'mcp-admin',
          userId: sessionData.userId,
          scope: ['*'], // Admin has all permissions
          user: {
            id: sessionData.userId,
            email: sessionData.email,
            name: sessionData.name,
            role: sessionData.role
          }
        });
        
        await next();
        return;
      } catch (error) {
        return c.json({ error: 'Invalid session' }, 401);
      }
    }

    // No valid authentication
    return c.json({ error: 'Authentication required' }, 401);
  });

  return app;
}

/**
 * Require specific scope middleware
 */
export function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Admin has all scopes
    if (auth.type === 'mcp-admin' || auth.scope.includes('*')) {
      await next();
      return;
    }

    // Check if user has required scope
    if (!hasScope(scope, auth.scope)) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: scope,
        provided: auth.scope
      }, 403);
    }

    await next();
  };
}

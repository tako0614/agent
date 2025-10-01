import { Hono } from 'hono';
import { createAuthService } from '../auth';

type Bindings = {
  MCP_SERVER_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI: string;
  OAUTH_SCOPE?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Start OAuth 2.1 authorization flow
 * GET /auth/login
 */
app.get('/login', async (c) => {
  const authService = createAuthService({
    MCP_SERVER_URL: c.env.MCP_SERVER_URL,
    OAUTH_CLIENT_ID: c.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: c.env.OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: c.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPE: c.env.OAUTH_SCOPE,
  });

  try {
    const authUrl = await authService.startAuthorizationFlow(c);
    return c.redirect(authUrl.toString());
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to start authorization flow' }, 500);
  }
});

/**
 * OAuth 2.1 callback handler
 * GET /auth/callback?code=xxx&state=xxx
 */
app.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing authorization code or state' }, 400);
  }

  const authService = createAuthService({
    MCP_SERVER_URL: c.env.MCP_SERVER_URL,
    OAUTH_CLIENT_ID: c.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: c.env.OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: c.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPE: c.env.OAUTH_SCOPE,
  });

  try {
    await authService.handleCallback(c, code, state);
    
    // Redirect to frontend with success
    return c.redirect('/?login=success');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return c.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Logout endpoint
 * POST /auth/logout
 */
app.post('/logout', async (c) => {
  const authService = createAuthService({
    MCP_SERVER_URL: c.env.MCP_SERVER_URL,
    OAUTH_CLIENT_ID: c.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: c.env.OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: c.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPE: c.env.OAUTH_SCOPE,
  });

  authService.logout(c);
  return c.json({ success: true });
});

/**
 * Get current authentication status
 * GET /auth/status
 */
app.get('/status', async (c) => {
  const authService = createAuthService({
    MCP_SERVER_URL: c.env.MCP_SERVER_URL,
    OAUTH_CLIENT_ID: c.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: c.env.OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: c.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPE: c.env.OAUTH_SCOPE,
  });

  const isAuthenticated = authService.isAuthenticated(c);
  const tokens = authService.getTokens(c);

  return c.json({
    authenticated: isAuthenticated,
    scope: tokens?.scope || [],
    expiresAt: tokens?.expiresAt,
  });
});

/**
 * Refresh access token
 * POST /auth/refresh
 */
app.post('/refresh', async (c) => {
  const authService = createAuthService({
    MCP_SERVER_URL: c.env.MCP_SERVER_URL,
    OAUTH_CLIENT_ID: c.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: c.env.OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: c.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPE: c.env.OAUTH_SCOPE,
  });

  try {
    const tokens = await authService.refreshAccessToken(c);
    return c.json({
      success: true,
      expiresAt: tokens.expiresAt,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to refresh token' }, 401);
  }
});

export default app;


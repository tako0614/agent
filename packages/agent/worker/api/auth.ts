import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createAuthService } from '../auth';
import { generateMcpToken } from '../auth/mcp-token';

type Bindings = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  LINE_CLIENT_ID?: string;
  LINE_CLIENT_SECRET?: string;
  LINE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  MCP_PRIVATE_KEY?: string; // RSA private key for signing MCP tokens
};

const app = new Hono<{ Bindings: Bindings }>();

// OAuth login endpoints

/**
 * Initiate Google OAuth login
 */
app.get('/login/google', async (c) => {
  const authService = createAuthService({
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: c.env.GOOGLE_REDIRECT_URI || `${c.req.url.split('/api')[0]}/api/auth/callback/google`,
  });

  try {
    const state = authService.generateState();
    const codeVerifier = authService.generateCodeVerifier();
    const url = await authService.createGoogleAuthorizationURL(state, codeVerifier);

    // Determine if we're in a secure context
    const isSecure = new URL(c.req.url).protocol === 'https:';

  // Debug logging
  console.log('Google login - Setting cookies:', {
    state: state.substring(0, 10) + '...',
    codeVerifier: codeVerifier.substring(0, 10) + '...',
    isSecure,
    url: c.req.url,
    redirectUrl: url.toString()
  });    // Store state and code verifier in cookie for validation
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    
    setCookie(c, 'code_verifier', codeVerifier, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return c.redirect(url.toString());
  } catch (error) {
    console.error('Google OAuth error:', error);
    return c.json({ error: 'Failed to initiate Google login' }, 500);
  }
});

/**
 * Initiate LINE OAuth login
 */
app.get('/login/line', async (c) => {
  const authService = createAuthService({
    lineClientId: c.env.LINE_CLIENT_ID,
    lineClientSecret: c.env.LINE_CLIENT_SECRET,
    lineRedirectUri: c.env.LINE_REDIRECT_URI || `${c.req.url.split('/api')[0]}/api/auth/callback/line`,
  });

  try {
    const state = authService.generateState();
    const codeVerifier = authService.generateCodeVerifier();
    const url = await authService.createLINEAuthorizationURL(state, codeVerifier);

    // Determine if we're in a secure context
    const isSecure = new URL(c.req.url).protocol === 'https:';

    // Store state and code verifier in cookie for validation
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    
    setCookie(c, 'code_verifier', codeVerifier, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return c.redirect(url.toString());
  } catch (error) {
    console.error('LINE OAuth error:', error);
    return c.json({ error: 'Failed to initiate LINE login' }, 500);
  }
});

/**
 * Google OAuth callback
 */
app.get('/callback/google', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const codeVerifier = getCookie(c, 'code_verifier');

  // Debug logging with raw cookie header
  const cookieHeader = c.req.header('cookie');
  console.log('Google callback debug:', {
    code: code ? code.substring(0, 20) + '...' : 'MISSING',
    state: state ? state.substring(0, 20) + '...' : 'MISSING',
    storedState: storedState ? storedState.substring(0, 20) + '...' : 'MISSING',
    codeVerifier: codeVerifier ? codeVerifier.substring(0, 20) + '...' : 'MISSING',
    stateMatch: state === storedState,
    hasCookieHeader: !!cookieHeader,
    cookieHeader: cookieHeader || 'NO COOKIE HEADER',
    url: c.req.url
  });

  // Validate state and code verifier
  if (!code || !state || state !== storedState || !codeVerifier) {
    return c.json({ error: 'Invalid state, code, or code verifier' }, 400);
  }

  const authService = createAuthService({
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: c.env.GOOGLE_REDIRECT_URI || `${c.req.url.split('/api')[0]}/api/auth/callback/google`,
  });

  try {
    // Validate code and get user info
    const userInfo = await authService.validateGoogleCode(code, codeVerifier);

    // TODO: Save or update user in database
    // const user = await db.user.upsert({
    //   where: { email: userInfo.email },
    //   create: { ...userInfo },
    //   update: { ...userInfo }
    // });

    // Create session token
    const sessionToken = authService.createSessionToken(userInfo);

    // Determine if we're in a secure context
    const isSecure = new URL(c.req.url).protocol === 'https:';

    // Set session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Delete temporary cookies
    deleteCookie(c, 'oauth_state');
    deleteCookie(c, 'code_verifier');

    // Redirect to frontend
    const frontendUrl = c.env.FRONTEND_URL || c.req.url.split('/api')[0];
    return c.redirect(`${frontendUrl}?login=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    const frontendUrl = c.env.FRONTEND_URL || c.req.url.split('/api')[0];
    return c.redirect(`${frontendUrl}?login=error`);
  }
});

/**
 * LINE OAuth callback
 */
app.get('/callback/line', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const codeVerifier = getCookie(c, 'code_verifier');

  // Validate state and code verifier
  if (!code || !state || state !== storedState || !codeVerifier) {
    return c.json({ error: 'Invalid state, code, or code verifier' }, 400);
  }

  const authService = createAuthService({
    lineClientId: c.env.LINE_CLIENT_ID,
    lineClientSecret: c.env.LINE_CLIENT_SECRET,
    lineRedirectUri: c.env.LINE_REDIRECT_URI || `${c.req.url.split('/api')[0]}/api/auth/callback/line`,
  });

  try {
    // Validate code and get user info
    const userInfo = await authService.validateLINECode(code, codeVerifier);

    // TODO: Save or update user in database
    // const user = await db.user.upsert({
    //   where: { providerId: userInfo.id, provider: 'line' },
    //   create: { ...userInfo },
    //   update: { ...userInfo }
    // });

    // Create session token
    const sessionToken = authService.createSessionToken(userInfo);

    // Determine if we're in a secure context
    const isSecure = new URL(c.req.url).protocol === 'https:';

    // Set session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Delete temporary cookies
    deleteCookie(c, 'oauth_state');
    deleteCookie(c, 'code_verifier');

    // Redirect to frontend
    const frontendUrl = c.env.FRONTEND_URL || c.req.url.split('/api')[0];
    return c.redirect(`${frontendUrl}?login=success`);
  } catch (error) {
    console.error('LINE callback error:', error);
    const frontendUrl = c.env.FRONTEND_URL || c.req.url.split('/api')[0];
    return c.redirect(`${frontendUrl}?login=error`);
  }
});

/**
 * Logout
 */
app.post('/logout', async (c) => {
  deleteCookie(c, 'session');
  return c.json({ success: true });
});

/**
 * Check authentication status
 */
app.get('/status', async (c) => {
  const sessionToken = getCookie(c, 'session');

  if (!sessionToken) {
    return c.json({ authenticated: false });
  }

  const authService = createAuthService({});
  const userInfo = authService.validateSessionToken(sessionToken);

  if (!userInfo) {
    deleteCookie(c, 'session');
    return c.json({ authenticated: false });
  }

  return c.json({ 
    authenticated: true,
    userId: userInfo.id
  });
});

/**
 * Get current user information
 */
app.get('/me', async (c) => {
  const sessionToken = getCookie(c, 'session');

  if (!sessionToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const authService = createAuthService({});
  const userInfo = authService.validateSessionToken(sessionToken);

  if (!userInfo) {
    deleteCookie(c, 'session');
    return c.json({ error: 'Invalid session' }, 401);
  }

  // Return user information from session
  return c.json({
    userId: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    provider: userInfo.provider
  });
});

/**
 * Generate MCP access token for authenticated user
 * This token can be used to access MCP Server tools
 */
app.post('/mcp-token', async (c) => {
  const sessionToken = getCookie(c, 'session');

  if (!sessionToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const authService = createAuthService({});
  const userInfo = authService.validateSessionToken(sessionToken);

  if (!userInfo) {
    deleteCookie(c, 'session');
    return c.json({ error: 'Invalid session' }, 401);
  }

  const privateKey = c.env.MCP_PRIVATE_KEY;
  if (!privateKey) {
    return c.json({ error: 'MCP token generation not configured' }, 500);
  }

  try {
    const token = await generateMcpToken(
      userInfo.id,
      userInfo.email,
      userInfo.name,
      privateKey
    );

    return c.json({
      token,
      expiresIn: 3600, // 1 hour
      tokenType: 'Bearer'
    });
  } catch (error) {
    console.error('Error generating MCP token:', error);
    return c.json({ 
      error: 'Failed to generate MCP token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;

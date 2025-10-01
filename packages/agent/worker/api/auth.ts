import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createAuthService } from '../auth';

type Bindings = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  LINE_CLIENT_ID?: string;
  LINE_CLIENT_SECRET?: string;
  LINE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
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
    const url = await authService.createGoogleAuthorizationURL(state);

    // Store state and code verifier in cookie for validation
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    
    setCookie(c, 'code_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
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
    const url = await authService.createLINEAuthorizationURL(state);

    // Store state and code verifier in cookie for validation
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    
    setCookie(c, 'code_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
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
    const sessionToken = authService.createSessionToken(userInfo.id);

    // Set session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: true,
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
    const sessionToken = authService.createSessionToken(userInfo.id);

    // Set session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: true,
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
 * Get current user
 */
app.get('/me', async (c) => {
  const sessionToken = getCookie(c, 'session');

  if (!sessionToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // TODO: Get user from database
  // const user = await db.user.findUnique({
  //   where: { id: session.userId }
  // });

  return c.json({
    userId: session.userId,
    // ...user
  });
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
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    deleteCookie(c, 'session');
    return c.json({ authenticated: false });
  }

  return c.json({ 
    authenticated: true,
    userId: session.userId
  });
});

export default app;

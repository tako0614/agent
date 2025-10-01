import { Hono } from 'hono';
import { Google } from 'arctic';
import { verifyAiServiceToken } from './verify';

type Bindings = {
  MCP_GOOGLE_CLIENT_ID?: string;
  MCP_GOOGLE_CLIENT_SECRET?: string;
  MCP_GOOGLE_REDIRECT_URI?: string;
  AI_SERVICE_PUBLIC_KEY?: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// Google OAuth for MCP Administrators
auth.get('/login/google', (c) => {
  const google = new Google(
    c.env.MCP_GOOGLE_CLIENT_ID || '',
    c.env.MCP_GOOGLE_CLIENT_SECRET || '',
    c.env.MCP_GOOGLE_REDIRECT_URI || 'http://localhost:8788/auth/callback/google'
  );

  const state = crypto.randomUUID();
  const url = google.createAuthorizationURL(state, ['openid', 'profile', 'email']);

  // Store state in cookie for verification
  c.header('Set-Cookie', `mcp_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

  return c.redirect(url.toString());
});

// Google OAuth callback
auth.get('/callback/google', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookies = c.req.header('Cookie');
  
  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  // Verify state
  const stateCookie = cookies?.split(';').find(c => c.trim().startsWith('mcp_oauth_state='));
  const storedState = stateCookie?.split('=')[1];

  if (!storedState || storedState !== state) {
    return c.json({ error: 'Invalid state' }, 400);
  }

  try {
    const google = new Google(
      c.env.MCP_GOOGLE_CLIENT_ID || '',
      c.env.MCP_GOOGLE_CLIENT_SECRET || '',
      c.env.MCP_GOOGLE_REDIRECT_URI || 'http://localhost:8788/auth/callback/google'
    );

    const tokens = await google.validateAuthorizationCode(code);
    
    // Fetch user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    });

    if (!userResponse.ok) {
      return c.json({ error: 'Failed to fetch user info' }, 500);
    }

    const userData = await userResponse.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    // TODO: Store MCP admin user in database
    // For now, just create a session token

    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    // Set session cookie
    const sessionToken = btoa(JSON.stringify(sessionData));
    c.header('Set-Cookie', `mcp_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);

    // Clear state cookie
    c.header('Set-Cookie', `mcp_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);

    return c.json({
      success: true,
      user: {
        email: userData.email,
        name: userData.name
      }
    });
  } catch (error) {
    console.error('OAuth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Verify AI Service Token endpoint
auth.post('/verify-token', async (c) => {
  const body = await c.req.json();
  const token = body.token;

  if (!token) {
    return c.json({ error: 'Token required' }, 400);
  }

  try {
    const publicKey = c.env.AI_SERVICE_PUBLIC_KEY || '';
    const payload = await verifyAiServiceToken(token, publicKey);

    return c.json({
      valid: true,
      payload
    });
  } catch (error) {
    return c.json({ 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid token' 
    }, 401);
  }
});

// Logout endpoint
auth.post('/logout', (c) => {
  c.header('Set-Cookie', `mcp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return c.json({ success: true });
});

// Current user endpoint
auth.get('/me', (c) => {
  const cookies = c.req.header('Cookie');
  const sessionCookie = cookies?.split(';').find(c => c.trim().startsWith('mcp_session='));
  
  if (!sessionCookie) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const sessionToken = sessionCookie.split('=')[1];
    const sessionData = JSON.parse(atob(sessionToken));
    
    return c.json({
      user: {
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role
      }
    });
  } catch (error) {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

export default auth;

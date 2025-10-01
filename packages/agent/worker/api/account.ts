import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  AccountError,
  extractSessionTokenFromAuthHeader,
  registerAccount,
  loginAccount,
  getAccountProfile,
  updateAccount,
  deleteAccount,
  logoutAccount,
} from '../services/account';

const app = new Hono();

type AccountContext = Context;

function isSecureRequest(url: string) {
  return new URL(url).protocol === 'https:';
}

function setSessionCookie(c: AccountContext, token: string) {
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
}

function clearSessionCookie(c: AccountContext) {
  deleteCookie(c, 'session', {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: 'Lax',
    path: '/',
  });
}

function getSessionToken(c: AccountContext) {
  const authHeader = c.req.header('Authorization');
  const tokenFromHeader = extractSessionTokenFromAuthHeader(authHeader);
  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  return getCookie(c, 'session') || null;
}

app.post('/register', async (c) => {
  try {
    const body = await c.req.json() as {
      email?: string;
      name?: string;
      password?: string;
      provider?: 'email' | 'google' | 'line';
      providerId?: string;
    };

    const result = await registerAccount(body);
    setSessionCookie(c, result.sessionToken);

    return c.json({
      success: true,
      data: {
        user: result.account,
        sessionToken: result.sessionToken,
        message: result.message,
      },
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/login', async (c) => {
  try {
    const body = await c.req.json() as { email?: string; password?: string };
    const result = await loginAccount(body);
    setSessionCookie(c, result.sessionToken);

    return c.json({
      success: true,
      data: {
        user: result.account,
        sessionToken: result.sessionToken,
        message: result.message,
      },
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

app.get('/me', async (c) => {
  try {
    const token = getSessionToken(c);
    if (!token) {
      throw new AccountError('Authentication required', 401);
    }

    const profile = await getAccountProfile(token);

    return c.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

app.put('/update', async (c) => {
  try {
    const token = getSessionToken(c);
    if (!token) {
      throw new AccountError('Authentication required', 401);
    }

    const body = await c.req.json() as { name?: string; email?: string };
    const result = await updateAccount(token, body);
    setSessionCookie(c, result.sessionToken);

    return c.json({
      success: true,
      data: {
        user: result.account,
        sessionToken: result.sessionToken,
        message: result.message,
      },
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

app.delete('/delete', async (c) => {
  try {
    const token = getSessionToken(c);
    if (!token) {
      throw new AccountError('Authentication required', 401);
    }

    const result = await deleteAccount(token);
    clearSessionCookie(c);

    return c.json({
      success: true,
      data: { message: result.message },
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/logout', async (c) => {
  try {
    const result = await logoutAccount();
    clearSessionCookie(c);

    return c.json({
      success: true,
      data: { message: result.message },
    });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, status);
  }
});

export default app;

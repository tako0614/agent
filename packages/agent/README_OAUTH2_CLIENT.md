# Agent OAuth 2.1 Client Implementation

## Overview

Agent appは、MCP ServerのOAuth 2.1 Authorization Serverを利用するクライアントアプリケーションです。

## Architecture Changes

### Before (Old Implementation)
```
Agent App → Google OAuth directly → User authenticated → Custom session token
```

### After (OAuth 2.1 Implementation)
```
Agent App → MCP Server OAuth 2.1 → Google OAuth → User authenticated → JWT access token
```

## Key Features

- **Standard OAuth 2.1 Client**: Authorization Code + PKCE flow
- **MCP Server Integration**: MCP ServerのOAuth 2.1エンドポイントを利用
- **JWT Token Management**: Access token & refresh tokenの管理
- **Automatic Token Refresh**: Refresh tokenを使った自動更新
- **Secure Storage**: HttpOnly cookieでのtoken保存

## OAuth 2.1 Flow

### 1. Authorization Request

```typescript
// Generate PKCE challenge
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Store code verifier in session
setCookie(c, 'code_verifier', codeVerifier, {
  httpOnly: true,
  secure: true,
  maxAge: 600, // 10 minutes
});

// Redirect to MCP Server authorization endpoint
const authUrl = new URL(`${MCP_SERVER_URL}/oauth/authorize`);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', 'booking:read booking:create product:read');
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

return c.redirect(authUrl.toString());
```

### 2. Authorization Callback

```typescript
// Exchange authorization code for tokens
const tokenResponse = await fetch(`${MCP_SERVER_URL}/oauth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  }),
});

const tokens = await tokenResponse.json();
// {
//   access_token: "eyJhbGc...",
//   token_type: "Bearer",
//   expires_in: 3600,
//   refresh_token: "...",
//   scope: "booking:read booking:create"
// }

// Store tokens securely
setCookie(c, 'access_token', tokens.access_token, {
  httpOnly: true,
  secure: true,
  maxAge: tokens.expires_in,
});

setCookie(c, 'refresh_token', tokens.refresh_token, {
  httpOnly: true,
  secure: true,
  maxAge: 7 * 24 * 60 * 60, // 7 days
});
```

### 3. API Calls with Access Token

```typescript
// Call MCP Server tools with access token
const response = await fetch(`${MCP_SERVER_URL}/mcp/tools/booking/list`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

// If 401 Unauthorized, refresh token
if (response.status === 401) {
  const newAccessToken = await refreshAccessToken(refreshToken);
  // Retry with new token
}
```

### 4. Token Refresh

```typescript
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const tokenResponse = await fetch(`${MCP_SERVER_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await tokenResponse.json();
  return tokens.access_token;
}
```

## File Structure

```
packages/agent/worker/
├── auth/
│   ├── index.ts              # OAuth 2.1 client implementation
│   ├── pkce.ts               # PKCE helper functions
│   └── token-manager.ts      # Token storage and refresh logic
├── api/
│   └── mcp-client.ts         # MCP Server API client with auto token refresh
└── services/
    └── oauth.ts              # OAuth service for managing auth flow
```

## Implementation Files

### 1. `auth/pkce.ts`

```typescript
import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate PKCE code verifier (RFC 7636)
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge (S256)
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(codeVerifier);
  return hash.digest('base64url');
}
```

### 2. `auth/token-manager.ts`

```typescript
import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Store tokens in secure cookies
 */
export function storeTokens(c: Context, tokens: TokenSet): void {
  setCookie(c, 'access_token', tokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: Math.floor((tokens.expiresAt - Date.now()) / 1000),
    path: '/',
  });

  setCookie(c, 'refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

/**
 * Get tokens from cookies
 */
export function getTokens(c: Context): TokenSet | null {
  const accessToken = getCookie(c, 'access_token');
  const refreshToken = getCookie(c, 'refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: 0, // Not stored in cookie
  };
}

/**
 * Clear tokens from cookies
 */
export function clearTokens(c: Context): void {
  deleteCookie(c, 'access_token');
  deleteCookie(c, 'refresh_token');
}
```

### 3. `api/mcp-client.ts`

```typescript
/**
 * MCP Server API Client with automatic token refresh
 */
export class McpClient {
  private baseUrl: string;
  private clientId: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(config: { baseUrl: string; clientId: string }) {
    this.baseUrl = config.baseUrl;
    this.clientId = config.clientId;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Call MCP tool with automatic token refresh
   */
  async callTool<T = any>(
    tool: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    let response = await this.makeRequest(tool, method, body, this.accessToken);

    // If 401, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const newAccessToken = await this.refreshAccessToken(this.refreshToken);
      this.accessToken = newAccessToken;
      
      // Retry with new token
      response = await this.makeRequest(tool, method, body, newAccessToken);
    }

    if (!response.ok) {
      throw new Error(`MCP API error: ${response.statusText}`);
    }

    return await response.json();
  }

  private async makeRequest(
    tool: string,
    method: string,
    body: any,
    accessToken: string
  ): Promise<Response> {
    return fetch(`${this.baseUrl}/mcp/tools/${tool}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokens = await response.json();
    return tokens.access_token;
  }
}
```

## Environment Variables

```env
# .dev.vars
MCP_SERVER_URL=http://localhost:8788
OAUTH_CLIENT_ID=agent-app-client
OAUTH_CLIENT_SECRET=your-client-secret (optional for public clients)
OAUTH_REDIRECT_URI=http://localhost:8787/api/auth/callback
```

## Migration from Old Implementation

### Old Code (Remove)
```typescript
// packages/agent/worker/auth/index.ts
// Direct Google OAuth implementation
this.google = new Google(clientId, clientSecret, redirectUri);
```

### New Code (Use MCP Server OAuth)
```typescript
// packages/agent/worker/auth/index.ts
// OAuth 2.1 client for MCP Server
this.oauthService = new OAuthService({
  authorizationEndpoint: `${mcpServerUrl}/oauth/authorize`,
  tokenEndpoint: `${mcpServerUrl}/oauth/token`,
  clientId: clientId,
  redirectUri: redirectUri,
});
```

## Security Considerations

1. **PKCE**: S256 code challenge is mandatory
2. **Secure Storage**: Tokens stored in HttpOnly, Secure, SameSite cookies
3. **Token Refresh**: Automatic refresh on 401 responses
4. **HTTPS Only**: Use HTTPS in production
5. **State Parameter**: CSRF protection with state parameter

## Testing

```bash
# Start MCP Server (in packages/mcp-server)
npm run dev

# Start Agent (in packages/agent)
npm run dev:worker

# Test OAuth flow
1. Visit http://localhost:8787/
2. Click "Login" button
3. Redirected to MCP Server authorization page
4. Approve access
5. Redirected back with authorization code
6. Agent exchanges code for tokens
7. Access token stored in cookie
```

## References

- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) - OAuth 2.0
- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) - PKCE
- [OAuth 2.1 Draft](https://oauth.net/2.1/) - OAuth 2.1 Specification
- MCP Server OAuth 2.1 Implementation: `packages/mcp-server/README_OAUTH.md`

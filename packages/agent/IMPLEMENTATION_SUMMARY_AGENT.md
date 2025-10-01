# Agent Side OAuth 2.1 Implementation Summary

## Overview

Agent appを完全にOAuth 2.1クライアントとして実装しました。MCP ServerのOAuth 2.1 Authorization Serverと統合し、標準準拠の認証フローを実現しています。

## Implementation Status

### ✅ Completed

#### 1. OAuth 2.1 Client Core (`worker/auth/`)

- **`oauth-client.ts`**: OAuth 2.1クライアント実装
  - Authorization URL生成
  - Authorization codeのtoken exchange
  - Refresh tokenによるtoken更新
  - Dynamic Client Registration対応
  
- **`pkce.ts`**: PKCE (Proof Key for Code Exchange) 実装
  - Code verifier生成 (32 bytes random)
  - Code challenge生成 (SHA256)
  - State parameter生成 (CSRF保護)

- **`token-manager.ts`**: Token storage and management
  - Secure HttpOnly cookieでtoken保存
  - Access token/refresh token管理
  - Token expiration tracking
  - PKCE parametersのsession管理

- **`index.ts`**: 統合された認証サービス
  - Authorization flow開始
  - OAuth callback処理
  - Token refresh
  - Authentication status確認
  - Logout

#### 2. MCP Server API Client (`worker/api/`)

- **`mcp-client.ts`**: MCP Server API client
  - Bearer token authentication
  - Automatic token refresh on 401
  - Convenience methods for MCP tools
  - Error handling with retry logic

#### 3. Authentication API Routes (`worker/api/auth.ts`)

- `GET /auth/login` - Start OAuth 2.1 flow
- `GET /auth/callback` - Handle OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/status` - Check authentication status
- `POST /auth/refresh` - Refresh access token

#### 4. Main Application (`worker/index.ts`)

- Updated Bindings type for OAuth 2.1 environment variables
- Mounted auth routes
- Added OAuth endpoints to root response

#### 5. Documentation

- **`README_OAUTH2_CLIENT.md`**: Complete OAuth 2.1 client implementation guide
  - Architecture diagrams
  - OAuth 2.1 flow with code examples
  - Security considerations
  - Environment variables
  - Testing instructions

- **`.dev.vars.example`**: Environment variable template
  - MCP Server OAuth 2.1 settings
  - Client configuration
  - Optional services (Database, Payment, AI)

## Architecture Changes

### Before (Old Implementation)

```
Agent App
  ↓ Direct Google OAuth
Google OAuth
  ↓ User Authentication
Agent App
  ↓ Custom Session Token
```

**Issues:**
- Not standards-compliant
- No integration with MCP Server authentication
- Custom session token management
- Separate authentication systems

### After (OAuth 2.1 Implementation)

```
Agent App (OAuth 2.1 Client)
  ↓ Authorization Request (+ PKCE)
MCP Server (Authorization Server)
  ↓ Redirect to Google OAuth
Google OAuth
  ↓ User Authentication
MCP Server
  ↓ Authorization Code
Agent App
  ↓ Code Exchange (+ code_verifier)
MCP Server
  ↓ JWT Access Token + Refresh Token
Agent App
  ↓ Bearer Token Auth
MCP Server (Resource Server)
  ↓ Protected Resources (MCP Tools)
```

**Benefits:**
- ✅ Standards-compliant OAuth 2.1 + PKCE
- ✅ Unified authentication with MCP Server
- ✅ JWT tokens with signature verification
- ✅ Automatic token refresh
- ✅ Scope-based access control
- ✅ Secure token storage (HttpOnly cookies)

## File Changes Summary

### New Files

1. `packages/agent/worker/auth/oauth-client.ts` - OAuth 2.1 client
2. `packages/agent/worker/auth/pkce.ts` - PKCE implementation
3. `packages/agent/worker/auth/token-manager.ts` - Token management
4. `packages/agent/worker/api/mcp-client.ts` - MCP Server API client
5. `packages/agent/README_OAUTH2_CLIENT.md` - Implementation guide
6. `packages/agent/.dev.vars.example` - Environment variable template
7. `packages/agent/IMPLEMENTATION_SUMMARY_AGENT.md` - This file

### Modified Files

1. `packages/agent/worker/auth/index.ts`
   - **Before**: Direct Google/LINE OAuth with arctic library
   - **After**: OAuth 2.1 client service using MCP Server
   - **Breaking changes**: 
     - Removed `validateGoogleCode()`, `validateLINECode()`
     - Removed session token methods
     - Added `startAuthorizationFlow()`, `handleCallback()`

2. `packages/agent/worker/api/auth.ts`
   - **Before**: Multiple OAuth providers (Google, LINE), custom session tokens
   - **After**: Single OAuth 2.1 client flow via MCP Server
   - **Breaking changes**:
     - Removed `/login/google`, `/login/line`
     - Removed `/callback/google`, `/callback/line`
     - Removed `/mcp-token` endpoint
     - Added `/login`, `/callback`, `/refresh`

3. `packages/agent/worker/index.ts`
   - **Before**: Google/LINE OAuth environment variables
   - **After**: OAuth 2.1 environment variables
   - **Breaking changes**:
     - Removed `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
     - Removed `LINE_CLIENT_ID`, `LINE_CLIENT_SECRET`, `LINE_REDIRECT_URI`
     - Added `MCP_SERVER_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `OAUTH_SCOPE`

### Deprecated Files

1. `packages/agent/worker/auth/mcp-token.ts`
   - **Status**: No longer used
   - **Reason**: MCP Server now issues JWT tokens via OAuth 2.1
   - **Action**: Can be safely deleted

## Environment Variables

### Required

```bash
MCP_SERVER_URL=http://localhost:8788
OAUTH_CLIENT_ID=agent-app-client
OAUTH_REDIRECT_URI=http://localhost:8787/auth/callback
```

### Optional

```bash
OAUTH_CLIENT_SECRET=  # For confidential clients
OAUTH_SCOPE=booking:read booking:create product:read order:read
FRONTEND_URL=http://localhost:3000
```

## OAuth 2.1 Flow Example

### 1. User clicks "Login"

```http
GET /auth/login
```

Agent generates PKCE parameters, stores in cookies, redirects to MCP Server:

```http
HTTP/1.1 302 Found
Location: http://localhost:8788/oauth/authorize?
  response_type=code&
  client_id=agent-app-client&
  redirect_uri=http://localhost:8787/auth/callback&
  state=abc123&
  code_challenge=xyz789&
  code_challenge_method=S256&
  scope=booking:read booking:create
```

### 2. MCP Server authenticates user

MCP Server redirects to Google OAuth, user authenticates, MCP Server issues authorization code:

```http
HTTP/1.1 302 Found
Location: http://localhost:8787/auth/callback?
  code=AUTHORIZATION_CODE&
  state=abc123
```

### 3. Agent exchanges code for tokens

```http
POST /oauth/token HTTP/1.1
Host: localhost:8788
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
redirect_uri=http://localhost:8787/auth/callback&
client_id=agent-app-client&
code_verifier=CODE_VERIFIER
```

Response:

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "booking:read booking:create"
}
```

### 4. Agent calls MCP Server API

```http
GET /mcp/tools/booking/list HTTP/1.1
Host: localhost:8788
Authorization: Bearer eyJhbGc...
```

If 401 Unauthorized, agent automatically refreshes token:

```http
POST /oauth/token HTTP/1.1
Host: localhost:8788
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=...&
client_id=agent-app-client
```

## Security Features

### ✅ Implemented

1. **PKCE (S256)**: Prevents authorization code interception attacks
2. **State Parameter**: CSRF protection during OAuth flow
3. **HttpOnly Cookies**: Protects tokens from XSS attacks
4. **Secure Cookies**: Ensures cookies only sent over HTTPS
5. **SameSite=Lax**: Additional CSRF protection
6. **Automatic Token Refresh**: Seamless user experience
7. **JWT Verification**: MCP Server verifies token signatures
8. **Scope-based Access Control**: Fine-grained permissions

### 🔒 Best Practices

1. Use HTTPS in production
2. Rotate JWT_SECRET regularly
3. Set short access token expiration (1 hour)
4. Use refresh token rotation
5. Monitor failed authentication attempts
6. Implement rate limiting
7. Log security events

## Testing

### 1. Start MCP Server

```bash
cd packages/mcp-server
npm run dev
```

### 2. Register OAuth Client

```bash
curl -X POST http://localhost:8788/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Agent App",
    "redirect_uris": ["http://localhost:8787/auth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "scope": "booking:read booking:create product:read"
  }'
```

Copy the `client_id` to `.dev.vars`.

### 3. Start Agent App

```bash
cd packages/agent
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your client_id
npm run dev:worker
```

### 4. Test OAuth Flow

1. Visit `http://localhost:8787/`
2. Click "Login" (or navigate to `/auth/login`)
3. Redirected to MCP Server authorization page
4. Approve access
5. Redirected back to Agent with authorization code
6. Agent exchanges code for tokens
7. Access token stored in cookie
8. Try calling MCP API endpoints

### 5. Test Token Refresh

```bash
# Check auth status
curl http://localhost:8787/auth/status \
  -H "Cookie: access_token=...; refresh_token=..."

# Wait for access token to expire (or manually delete)
# Then call API - should auto-refresh

# Manual refresh
curl -X POST http://localhost:8787/auth/refresh \
  -H "Cookie: refresh_token=..."
```

## Migration Guide

### From Old Implementation to OAuth 2.1

#### 1. Update Environment Variables

**Before:**
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
```

**After:**
```bash
MCP_SERVER_URL=http://localhost:8788
OAUTH_CLIENT_ID=agent-app-client
OAUTH_REDIRECT_URI=http://localhost:8787/auth/callback
```

#### 2. Update Login Flow

**Before:**
```javascript
// Redirect to /auth/login/google
window.location.href = '/auth/login/google';
```

**After:**
```javascript
// Redirect to /auth/login (MCP Server handles provider selection)
window.location.href = '/auth/login';
```

#### 3. Update API Calls

**Before:**
```javascript
// Custom session token in cookie
fetch('/api/endpoint', {
  credentials: 'include' // Session cookie
});
```

**After:**
```javascript
// JWT access token in cookie (or Bearer token in header)
fetch('/api/endpoint', {
  credentials: 'include' // Access token cookie
});

// Or use MCP Client (auto token refresh)
const mcpClient = createMcpClient({ ... });
const data = await mcpClient.callTool('booking/list');
```

## Next Steps

### ⏭️ Immediate

1. ✅ Delete deprecated `worker/auth/mcp-token.ts`
2. ✅ Create `.dev.vars` from `.dev.vars.example`
3. ✅ Register OAuth client with MCP Server
4. ✅ Test OAuth flow end-to-end

### 📋 Future Enhancements

1. **Frontend Integration**: Update SolidJS components to use new OAuth flow
2. **Token Introspection**: Add token introspection endpoint support
3. **Token Revocation**: Implement token revocation
4. **Remember Me**: Implement persistent sessions
5. **Multi-factor Authentication**: Add MFA support via MCP Server
6. **Social Login**: Support multiple providers (LINE, GitHub, etc.)

## Related Documentation

- [Agent OAuth 2.1 Client Guide](./README_OAUTH2_CLIENT.md)
- [MCP Server OAuth 2.1 Implementation](../mcp-server/README_OAUTH.md)
- [MCP Server Setup Guide](../mcp-server/SETUP_OAUTH.md)
- [Architecture Documentation](../../docs/architecture/SEPARATION_ARCHITECTURE_OAUTH2.md)
- [Authentication Guide](../../docs/guides/MCP_AUTH_OAUTH2.md)

## References

- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) - OAuth 2.0 Authorization Framework
- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) - Proof Key for Code Exchange (PKCE)
- [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html) - OAuth 2.0 Authorization Server Metadata
- [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728.html) - OAuth 2.0 Protected Resource Metadata
- [OAuth 2.1 Draft](https://oauth.net/2.1/) - OAuth 2.1 Authorization Framework (Draft)

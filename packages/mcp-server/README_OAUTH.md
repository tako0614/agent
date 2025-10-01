# MCP Server - OAuth 2.1 Standard Implementation

標準的なMCP OAuth 2.1認証を実装したModel Context Protocolサーバーです。

## 🌟 特徴

- ✅ **OAuth 2.1準拠**: Authorization Code + PKCE フロー
- ✅ **RFC 9728**: Protected Resource Metadata (PRM) 対応
- ✅ **RFC 8414**: Authorization Server Metadata 対応
- ✅ **RFC 8707**: Resource Indicators 対応
- ✅ **JWT アクセストークン**: 標準的なBearer認証
- ✅ **Dynamic Client Registration (DCR)**: 自動クライアント登録
- ✅ **Google OAuth統合**: ユーザー認証
- ✅ **独立したアカウントシステム**: MCPサーバー独自のユーザー管理

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  MCPクライアント (Claude/Cursor/Inspector)               │
│  - OAuth 2.1 クライアント                                │
│  - Authorization Code + PKCE                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ 1. GET /.well-known/oauth-protected-resource
                 │ 2. GET /.well-known/oauth-authorization-server
                 │ 3. GET /oauth/authorize?client_id=...
                 │ 4. POST /oauth/token
                 │ 5. API calls with Bearer token
                 ▼
┌─────────────────────────────────────────────────────────┐
│  MCPサーバー (localhost:8788)                            │
│  - 認可サーバー機能                                       │
│  - リソースサーバー機能                                   │
│  - Google OAuth統合 (ユーザー認証)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                    │
│  - OAuthClient (クライアント登録)                         │
│  - AuthorizationCode (認可コード)                         │
│  - AccessToken (アクセストークン)                         │
│  - RefreshToken (リフレッシュトークン)                    │
│  - User (ユーザー情報)                                    │
└─────────────────────────────────────────────────────────┘
```

## 🚀 セットアップ

### 1. 環境変数の設定

`.dev.vars.example` を `.dev.vars` にコピーして編集:

```bash
cp .dev.vars.example .dev.vars
```

```bash
# OAuth 2.1 Configuration
MCP_ISSUER=http://localhost:8788
JWT_SECRET=your-secret-key-at-least-32-characters-long

# Google OAuth
MCP_GOOGLE_CLIENT_ID=your-google-client-id
MCP_GOOGLE_CLIENT_SECRET=your-google-client-secret
MCP_GOOGLE_REDIRECT_URI=http://localhost:8788/auth/callback/google

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agent
```

### 2. データベースマイグレーション

```bash
cd ../database
npx prisma migrate dev --name oauth2_implementation
npx prisma generate
```

### 3. サーバー起動

```bash
npm run dev
```

サーバーは `http://localhost:8788` で起動します。

## 📡 OAuth 2.1 エンドポイント

### メタデータエンドポイント

#### Authorization Server Metadata (RFC 8414)
```http
GET /.well-known/oauth-authorization-server
```

レスポンス:
```json
{
  "issuer": "http://localhost:8788",
  "authorization_endpoint": "http://localhost:8788/oauth/authorize",
  "token_endpoint": "http://localhost:8788/oauth/token",
  "registration_endpoint": "http://localhost:8788/oauth/register",
  "scopes_supported": ["booking:read", "booking:write", ...],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"]
}
```

#### Protected Resource Metadata (RFC 9728)
```http
GET /.well-known/oauth-protected-resource
```

レスポンス:
```json
{
  "resource": "http://localhost:8788",
  "authorization_servers": ["http://localhost:8788"],
  "scopes_supported": ["booking:read", "booking:write", ...],
  "token_types_supported": ["Bearer"]
}
```

### 認可フロー

#### 1. クライアント登録 (Dynamic Client Registration)

```http
POST /oauth/register
Content-Type: application/json

{
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

レスポンス:
```json
{
  "client_id": "uuid-generated-client-id",
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:3000/callback"]
}
```

#### 2. 認可リクエスト

```http
GET /oauth/authorize?
  response_type=code&
  client_id=CLIENT_ID&
  redirect_uri=http://localhost:3000/callback&
  scope=booking:read product:read&
  state=random-state&
  code_challenge=BASE64_URL_ENCODED_CHALLENGE&
  code_challenge_method=S256&
  resource=http://localhost:8788
```

ユーザーが未認証の場合は Google OAuth にリダイレクトされます。

#### 3. トークン取得

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
redirect_uri=http://localhost:3000/callback&
client_id=CLIENT_ID&
code_verifier=ORIGINAL_CODE_VERIFIER
```

レスポンス:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "uuid-refresh-token",
  "scope": "booking:read product:read"
}
```

#### 4. リフレッシュトークン

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=REFRESH_TOKEN&
client_id=CLIENT_ID
```

## 🔒 API保護

### 401レスポンス (未認証)

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:8788/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "error": "unauthorized",
  "error_description": "Bearer token required. See WWW-Authenticate header for authentication details."
}
```

### 認証済みリクエスト

```http
GET /mcp/tools/booking
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔑 スコープ定義

| スコープ | 説明 |
|---------|------|
| `booking:read` | 予約情報の読み取り |
| `booking:write` | 予約の作成・更新・削除 |
| `product:read` | 商品情報の読み取り |
| `product:write` | 商品の作成・更新・削除 |
| `order:read` | 注文情報の読み取り |
| `order:write` | 注文の作成・更新 |
| `form:read` | フォーム情報の読み取り |
| `form:write` | フォームの作成・投稿 |

## 🧪 テスト

### 1. メタデータ確認

```bash
# Authorization Server Metadata
curl http://localhost:8788/.well-known/oauth-authorization-server | jq

# Protected Resource Metadata
curl http://localhost:8788/.well-known/oauth-protected-resource | jq
```

### 2. クライアント登録

```bash
curl -X POST http://localhost:8788/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["http://localhost:3000/callback"]
  }' | jq
```

### 3. 401レスポンス確認

```bash
curl -v http://localhost:8788/mcp/tools/booking
# WWW-Authenticate ヘッダが返されることを確認
```

## 📚 参考仕様

- [MCP Authentication](https://modelcontextprotocol.io/docs/specification/authentication)
- [RFC 9728: Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 8707: Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7591: Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)

## 🔐 セキュリティ

- ✅ PKCE (S256) 必須
- ✅ State パラメータ検証
- ✅ JWT 署名検証
- ✅ トークン有効期限チェック
- ✅ Redirect URI 検証
- ✅ HTTPS推奨 (本番環境)
- ⚠️ 本番環境では `JWT_SECRET` を強力なランダム値に変更
- ⚠️ 本番環境では RS256 (RSA署名) の使用を推奨

## 🎯 次のステップ

- [ ] DPoP (RFC 9449) 実装でトークン盗難対策
- [ ] mTLS (RFC 8705) サポート
- [ ] Consent画面の実装
- [ ] Admin UIの実装
- [ ] トークンの取り消しエンドポイント
- [ ] Introspectionエンドポイント (RFC 7662)
- [ ] RS256署名への移行 (JWKS公開)

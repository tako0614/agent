# MCP OAuth 2.1 認証システム (標準実装)

## 概要

MCPサーバーは**独立したCloudflare Workersプロジェクト**として別ドメインに配置され、**標準的なOAuth 2.1認証**を実装しています。

### アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────┐
│  MCPクライアント (Claude/Cursor/任意のAIクライアント)      │
│  - OAuth 2.1 標準準拠                                     │
│  - Authorization Code + PKCE フロー                       │
└────────────────┬─────────────────────────────────────────┘
                 │ 
                 │ 1. メタデータ取得
                 │ 2. OAuth 2.1フロー
                 │ 3. JWT Bearer トークン
                 ▼
┌──────────────────────────────────────────────────────────┐
│  MCPサーバー (mcp-api.example.com)                        │
│  - 認可サーバー (Authorization Server)                    │
│  - リソースサーバー (Resource Server)                     │
│  - Google OAuth統合 (ユーザー認証)                        │
│  - JWT トークン検証                                       │
│  - MCP Tools提供                                          │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                     │
│  - User (ユーザー情報)                                    │
│  - OAuthClient (クライアント登録)                         │
│  - AuthorizationCode (認可コード)                         │
│  - AccessToken (アクセストークン - JWT)                   │
│  - RefreshToken (リフレッシュトークン)                    │
└──────────────────────────────────────────────────────────┘
```

## 標準準拠

MCPサーバーは以下のRFC標準に準拠しています:

| RFC | タイトル | 実装状況 |
|-----|---------|---------|
| RFC 8414 | Authorization Server Metadata | ✅ 完全実装 |
| RFC 9728 | Protected Resource Metadata (PRM) | ✅ 完全実装 |
| RFC 8707 | Resource Indicators | ✅ 実装 |
| RFC 7636 | PKCE | ✅ S256必須 |
| RFC 7591 | Dynamic Client Registration | ✅ 実装 |
| RFC 6749 | OAuth 2.0 | ✅ Authorization Code Flow |

## 認証フロー

### OAuth 2.1 標準フロー

```
1. クライアントがPRM取得
   GET /.well-known/oauth-protected-resource
   
2. 認可サーバーメタデータ取得
   GET /.well-known/oauth-authorization-server
   
3. クライアント登録 (DCR)
   POST /oauth/register
   {
     "client_name": "My MCP Client",
     "redirect_uris": ["http://localhost:3000/callback"]
   }
   
4. 認可リクエスト (PKCE)
   GET /oauth/authorize?
     response_type=code&
     client_id=CLIENT_ID&
     redirect_uri=REDIRECT_URI&
     scope=booking:read product:read&
     state=RANDOM_STATE&
     code_challenge=CODE_CHALLENGE&
     code_challenge_method=S256&
     resource=https://mcp-api.example.com
   
   → ユーザーが未認証の場合、Google OAuthにリダイレクト
   → ユーザー認証完了後、認可コードを発行
   
5. トークン取得
   POST /oauth/token
   {
     "grant_type": "authorization_code",
     "code": "AUTHORIZATION_CODE",
     "redirect_uri": "REDIRECT_URI",
     "client_id": "CLIENT_ID",
     "code_verifier": "CODE_VERIFIER"
   }
   
   レスポンス:
   {
     "access_token": "eyJhbGc...(JWT)",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "REFRESH_TOKEN",
     "scope": "booking:read product:read"
   }
   
6. API呼び出し
   GET /mcp/tools/booking
   Authorization: Bearer eyJhbGc...
   
7. トークンリフレッシュ (必要時)
   POST /oauth/token
   {
     "grant_type": "refresh_token",
     "refresh_token": "REFRESH_TOKEN",
     "client_id": "CLIENT_ID"
   }
```

## エンドポイント一覧

### OAuth 2.1 メタデータエンドポイント

| エンドポイント | 説明 | RFC |
|--------------|------|-----|
| `GET /.well-known/oauth-authorization-server` | Authorization Server Metadata | RFC 8414 |
| `GET /.well-known/oauth-protected-resource` | Protected Resource Metadata | RFC 9728 |

### OAuth 2.1 認可エンドポイント

| エンドポイント | 説明 | RFC |
|--------------|------|-----|
| `POST /oauth/register` | Dynamic Client Registration | RFC 7591 |
| `GET /oauth/authorize` | 認可リクエスト | RFC 6749 |
| `POST /oauth/token` | トークン取得・リフレッシュ | RFC 6749 |
| `GET /oauth/jwks` | JSON Web Key Set | RFC 7517 |

### ユーザー認証エンドポイント

| エンドポイント | 説明 |
|--------------|------|
| `GET /auth/login/google` | Google OAuth ログイン |
| `GET /auth/callback/google` | Google OAuth コールバック |
| `GET /auth/me` | 現在のユーザー情報 |
| `POST /auth/logout` | ログアウト |

### MCP Tools (認証必須)

| エンドポイント | 説明 | 必要スコープ |
|--------------|------|------------|
| `GET /mcp/tools` | ツール一覧 | - |
| `/mcp/tools/booking/*` | 予約管理 | `booking:read`, `booking:write` |
| `/mcp/tools/product/*` | 商品管理 | `product:read`, `product:write` |
| `/mcp/tools/order/*` | 注文管理 | `order:read`, `order:write` |
| `/mcp/tools/form/*` | フォーム管理 | `form:read`, `form:write` |

## 認証保護の実装

### 401 + WWW-Authenticate ヘッダ (RFC 9728)

未認証のリクエストには、標準的な401レスポンスを返します:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp-api.example.com/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "error": "unauthorized",
  "error_description": "Bearer token required. See WWW-Authenticate header for authentication details."
}
```

### JWT トークン検証

アクセストークンはJWT形式で、以下を検証します:

```typescript
// トークン検証
const { payload } = await jwtVerify(token, secret, {
  issuer: 'https://mcp-api.example.com',
  audience: 'https://mcp-api.example.com',
});

// ペイロード構造
{
  "sub": "user-id",              // ユーザーID
  "client_id": "client-id",      // クライアントID
  "scope": ["booking:read", ...], // 許可されたスコープ
  "iss": "https://mcp-api.example.com",
  "aud": "https://mcp-api.example.com",
  "exp": 1234567890,             // 有効期限
  "iat": 1234567890              // 発行日時
}
```

## スコープ定義

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

## セキュリティ機能

### 実装済み

- ✅ **PKCE (S256)** - 認可コード横取り攻撃の防止
- ✅ **State パラメータ** - CSRF攻撃の防止
- ✅ **JWT 署名検証** - トークン改ざんの防止
- ✅ **トークン有効期限** - アクセストークン: 1時間、リフレッシュトークン: 30日
- ✅ **Redirect URI 検証** - オープンリダイレクタの防止
- ✅ **認可コード一回限り使用** - リプレイ攻撃の防止
- ✅ **スコープベースのアクセス制御** - 最小権限の原則

### 推奨 (本番環境)

- ⚠️ **HTTPS必須** - 通信の暗号化
- ⚠️ **強力なJWT_SECRET** - 32文字以上のランダム文字列
- ⚠️ **RS256署名** - 公開鍵暗号 (現在はHS256)
- 💡 **DPoP (RFC 9449)** - トークン盗難対策 (将来実装)
- 💡 **mTLS (RFC 8705)** - 相互TLS認証 (将来実装)

## データベーススキーマ

### OAuth 2.1 関連テーブル

```prisma
// OAuth クライアント登録
model OAuthClient {
  id                      String   @id @default(cuid())
  clientId                String   @unique
  clientSecret            String?  // Null for public clients
  name                    String
  redirectUris            String[]
  grantTypes              String[]
  responseTypes           String[]
  scopes                  String[]
  tokenEndpointAuthMethod String   @default("none")
  isPublic                Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  @@map("oauth_clients")
}

// 認可コード (PKCE必須)
model AuthorizationCode {
  id                  String   @id @default(cuid())
  code                String   @unique
  clientId            String
  userId              String
  redirectUri         String
  scope               String[]
  codeChallenge       String   // PKCE
  codeChallengeMethod String   @default("S256")
  resource            String?  // RFC 8707
  expiresAt           DateTime
  createdAt           DateTime @default(now())
  
  @@map("authorization_codes")
}

// アクセストークン (JWT)
model AccessToken {
  id        String   @id @default(cuid())
  token     String   @unique  // JWT
  clientId  String
  userId    String
  scope     String[]
  resource  String?
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@map("access_tokens")
}

// リフレッシュトークン
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  clientId  String
  userId    String
  scope     String[]
  resource  String?
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("refresh_tokens")
}
```

## 実装ファイル

### MCPサーバー (`packages/mcp-server/worker/`)

#### 1. `worker/oauth/index.ts` - OAuth 2.1 サーバー実装

- Authorization Server Metadata エンドポイント
- Protected Resource Metadata エンドポイント
- 認可エンドポイント (`/oauth/authorize`)
- トークンエンドポイント (`/oauth/token`)
- Dynamic Client Registration (`/oauth/register`)
- JWKS エンドポイント (`/oauth/jwks`)

#### 2. `worker/auth/index.ts` - ユーザー認証

- Google OAuth統合
- ユーザー登録・ログイン
- セッション管理

#### 3. `worker/auth/verify.ts` - トークン検証

```typescript
// JWT検証 (標準OAuth 2.1)
export async function verifyAccessToken(
  token: string,
  jwtSecret: string,
  expectedIssuer: string,
  expectedAudience: string
): Promise<TokenPayload>

// スコープ検証
export function hasScope(
  requiredScope: string,
  userScopes: string[]
): boolean
```

#### 4. `worker/mcp/middleware.ts` - 認証ミドルウェア

```typescript
// OAuth 2.1準拠の認証ミドルウェア
// - Bearer トークン必須
// - 401 + WWW-Authenticate ヘッダ
// - JWT検証
// - スコープ検証
export function middleware(handler: any): any
```

#### 5. `worker/mcp/tools/*` - MCP Tools

- `booking.ts` - 予約管理ツール
- `product.ts` - 商品管理ツール
- `order.ts` - 注文管理ツール
- `form.ts` - フォーム管理ツール

## 環境変数

```bash
# OAuth 2.1 Configuration
MCP_ISSUER=https://mcp-api.example.com
JWT_SECRET=<strong-random-secret-32-chars-minimum>

# Google OAuth (ユーザー認証用)
MCP_GOOGLE_CLIENT_ID=<your-google-client-id>
MCP_GOOGLE_CLIENT_SECRET=<your-google-client-secret>
MCP_GOOGLE_REDIRECT_URI=https://mcp-api.example.com/auth/callback/google

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# CORS
ALLOWED_ORIGINS=https://your-frontend.example.com
```

## デプロイ

### 開発環境

```bash
cd packages/mcp-server
npm run dev
# http://localhost:8788
```

### 本番環境 (Cloudflare Workers)

```bash
# Secretsの設定
wrangler secret put JWT_SECRET
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put DATABASE_URL

# デプロイ
npm run deploy
```

## テスト

### メタデータ確認

```bash
curl https://mcp-api.example.com/.well-known/oauth-authorization-server | jq
curl https://mcp-api.example.com/.well-known/oauth-protected-resource | jq
```

### 401レスポンス確認

```bash
curl -v https://mcp-api.example.com/mcp/tools/booking
# WWW-Authenticate ヘッダを確認
```

## 互換性

この実装は以下と互換性があります:

- ✅ Claude Desktop
- ✅ Cursor
- ✅ MCP Inspector
- ✅ その他の標準的なMCPクライアント
- ✅ 任意のOAuth 2.1クライアント

## 参考資料

- [MCP Authentication Specification](https://modelcontextprotocol.io/docs/specification/authentication)
- [RFC 9728: Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 8707: Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7591: Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)

## 移行メモ

### 旧実装からの変更点

**Before (独自実装)**:
- DBベースのランダムトークン
- AIサービスがトークンを発行
- 独自の認証フロー

**After (標準OAuth 2.1)**:
- JWT アクセストークン
- MCPサーバーが認可サーバーとして機能
- 標準的なOAuth 2.1フロー
- RFC準拠のメタデータエンドポイント
- 401 + WWW-Authenticate ヘッダ

### 後方互換性

レガシートークン (旧 `McpAccessToken`) も一時的にサポートしていますが、新しいクライアントはOAuth 2.1を使用してください。

# 分離アーキテクチャの詳細設計 (OAuth 2.1版)

## 概要

AIサービスとMCPサーバーを完全に分離し、**標準的なOAuth 2.1認証**を実装したアーキテクチャです。

## システム分離の理由

### 1. 標準準拠
- MCP公式仕様に完全準拠
- OAuth 2.1標準プロトコル
- RFC準拠のエンドポイント
- 業界標準のセキュリティ

### 2. セキュリティの向上
- 各サービスが独立した認証システム
- JWT署名検証
- PKCE必須化
- スコープベースのアクセス制御
- 攻撃対象領域の最小化

### 3. スケーラビリティ
- 各サービスを独立してスケール可能
- 負荷に応じた個別の最適化
- リソース使用の効率化
- マイクロサービスアーキテクチャ

### 4. 保守性の向上
- 独立したデプロイメント
- サービスごとの開発サイクル
- 影響範囲の限定
- 明確な責任分離

### 5. 相互運用性
- 標準プロトコルによる互換性
- 任意のOAuth 2.1クライアントと連携
- Claude Desktop、Cursor等と互換
- 将来的な拡張が容易

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│  MCPクライアント (Claude Desktop/Cursor/任意のクライアント)   │
│  - OAuth 2.1 標準クライアント                                │
│  - Authorization Code + PKCE フロー                          │
│  - JWT Bearer トークン                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS (OAuth 2.1)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Workers                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MCPサーバー (mcp-api.example.com)                    │  │
│  │  - project: packages/mcp-server                       │  │
│  │  - 認可サーバー (Authorization Server)                │  │
│  │  - リソースサーバー (Resource Server)                 │  │
│  │  - OAuth 2.1 エンドポイント                           │  │
│  │  - MCP Tools提供                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIサービス (ai-service.example.com) - オプション     │  │
│  │  - project: packages/agent                            │  │
│  │  - フロントエンド (SolidJS)                            │  │
│  │  - LangGraph AIエージェント                           │  │
│  │  - MCPサーバーのクライアントとして動作                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                         │
│  - User (ユーザー情報)                                        │
│  - OAuthClient (クライアント登録)                             │
│  - AuthorizationCode (認可コード)                             │
│  - AccessToken (アクセストークン)                             │
│  - RefreshToken (リフレッシュトークン)                        │
│  - MCP Tools データ (Booking/Product/Order/Form)             │
└─────────────────────────────────────────────────────────────┘
```

## プロジェクト構成

```
agent/
├── packages/
│   ├── mcp-server/            # MCPサーバー (OAuth 2.1)
│   │   ├── worker/            # MCPサーバーWorker
│   │   │   ├── oauth/         # OAuth 2.1 サーバー実装
│   │   │   │   └── index.ts      # AS Metadata, Token, Register
│   │   │   ├── auth/          # ユーザー認証
│   │   │   │   ├── index.ts      # Google OAuth
│   │   │   │   └── verify.ts     # JWT検証
│   │   │   ├── mcp/           # MCP Tools
│   │   │   │   ├── middleware.ts # 認証ミドルウェア
│   │   │   │   └── tools/        # 各種ツール
│   │   │   │       ├── booking.ts
│   │   │   │       ├── product.ts
│   │   │   │       ├── order.ts
│   │   │   │       └── form.ts
│   │   │   └── index.ts       # エントリーポイント
│   │   ├── wrangler.toml      # Workers設定
│   │   ├── package.json
│   │   ├── README.md          # OAuth 2.1対応
│   │   ├── README_OAUTH.md    # API詳細仕様
│   │   ├── SETUP_OAUTH.md     # セットアップガイド
│   │   └── .dev.vars          # 環境変数
│   │
│   ├── agent/                 # AIサービス (オプション)
│   │   ├── src/               # フロントエンド (SolidJS)
│   │   ├── worker/            # AIサービスWorker
│   │   │   ├── ai/            # LangGraph AI Agent
│   │   │   ├── api/           # REST API
│   │   │   ├── auth/          # Google/LINE OAuth
│   │   │   └── payment/       # Stripe決済
│   │   ├── wrangler.toml      # Workers設定
│   │   └── .dev.vars          # 環境変数
│   │
│   └── database/              # 共通データベース
│       └── prisma/
│           └── schema.prisma  # OAuth 2.1対応スキーマ
│
└── docs/
    ├── guides/
    │   ├── MCP_AUTH_OAUTH2.md # OAuth 2.1認証ガイド (新)
    │   └── MCP_AUTH.md        # 旧実装 (deprecated)
    └── architecture/
        └── SEPARATION_ARCHITECTURE_OAUTH2.md # 本ファイル
```

## OAuth 2.1 認証フロー詳細

### 1. MCPクライアント → MCPサーバー

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant M as MCP Server
    participant G as Google OAuth
    participant D as Database

    Note over C,M: ディスカバリーフェーズ
    C->>M: GET /.well-known/oauth-protected-resource
    M->>C: PRM (Protected Resource Metadata)
    
    C->>M: GET /.well-known/oauth-authorization-server
    M->>C: Authorization Server Metadata
    
    Note over C,M: クライアント登録 (DCR)
    C->>M: POST /oauth/register
    M->>D: クライアント情報保存
    M->>C: client_id, redirect_uris
    
    Note over C,M: 認可フェーズ
    C->>M: GET /oauth/authorize (PKCE challenge)
    Note over M: ユーザー未認証
    M->>G: Redirect to Google OAuth
    G->>User: Login & Consent
    User->>G: Approve
    G->>M: Google tokens
    M->>D: ユーザー情報保存
    M->>D: 認可コード保存
    M->>C: Redirect with authorization code
    
    Note over C,M: トークン取得フェーズ
    C->>M: POST /oauth/token (code + PKCE verifier)
    M->>D: 認可コード検証
    M->>D: PKCE検証
    M->>D: JWT生成・保存
    M->>C: access_token (JWT) + refresh_token
    
    Note over C,M: API呼び出しフェーズ
    C->>M: GET /mcp/tools/booking (Bearer JWT)
    M->>M: JWT検証 (署名・期限・スコープ)
    M->>D: データ取得
    M->>C: API Response
    
    Note over C,M: トークンリフレッシュ
    C->>M: POST /oauth/token (refresh_token)
    M->>D: リフレッシュトークン検証
    M->>D: 新JWT生成
    M->>C: new access_token
```

### 2. AIサービス経由のフロー (オプション)

AIサービスを介してMCPサーバーにアクセスする場合:

```mermaid
sequenceDiagram
    participant U as User
    participant A as AI Service
    participant M as MCP Server
    participant D as Database

    Note over U,A: ユーザー認証
    U->>A: Login (Google/LINE)
    A->>D: ユーザーセッション保存
    
    Note over A,M: AIサービスもOAuthクライアント
    A->>M: OAuth 2.1フロー (サーバーサイド)
    M->>A: access_token (JWT)
    
    Note over U,A: AIエージェント利用
    U->>A: "明日の予約を確認して"
    A->>A: LangGraph Agent処理
    A->>M: GET /mcp/tools/booking (Bearer JWT)
    M->>A: 予約データ
    A->>U: "明日14時に予約があります"
```

## エンドポイント詳細

### MCPサーバー (`http://localhost:8788` or `https://mcp-api.example.com`)

#### OAuth 2.1 メタデータ

| Method | Path | 説明 | RFC |
|--------|------|------|-----|
| GET | `/.well-known/oauth-authorization-server` | AS Metadata | RFC 8414 |
| GET | `/.well-known/oauth-protected-resource` | PRM | RFC 9728 |

#### OAuth 2.1 認可

| Method | Path | 説明 | RFC |
|--------|------|------|-----|
| POST | `/oauth/register` | DCR | RFC 7591 |
| GET | `/oauth/authorize` | 認可リクエスト | RFC 6749 |
| POST | `/oauth/token` | トークン取得/更新 | RFC 6749 |
| GET | `/oauth/jwks` | JWK Set | RFC 7517 |

#### ユーザー認証

| Method | Path | 説明 |
|--------|------|------|
| GET | `/auth/login/google` | Google OAuth開始 |
| GET | `/auth/callback/google` | OAuth コールバック |
| GET | `/auth/me` | ユーザー情報 |
| POST | `/auth/logout` | ログアウト |

#### MCP Tools (認証必須)

| Method | Path Pattern | 説明 | スコープ |
|--------|-------------|------|---------|
| GET | `/mcp/tools` | ツール一覧 | - |
| * | `/mcp/tools/booking/*` | 予約管理 | `booking:*` |
| * | `/mcp/tools/product/*` | 商品管理 | `product:*` |
| * | `/mcp/tools/order/*` | 注文管理 | `order:*` |
| * | `/mcp/tools/form/*` | フォーム管理 | `form:*` |

## データベーススキーマ (OAuth 2.1対応)

### 新規テーブル

```prisma
// OAuth 2.1 Client Registration
model OAuthClient {
  id                      String   @id @default(cuid())
  clientId                String   @unique
  clientSecret            String?
  name                    String
  redirectUris            String[]
  grantTypes              String[]
  responseTypes           String[]
  scopes                  String[]
  tokenEndpointAuthMethod String   @default("none")
  isPublic                Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  authorizationCodes AuthorizationCode[]
  accessTokens       AccessToken[]
  refreshTokens      RefreshToken[]
  
  @@map("oauth_clients")
}

// Authorization Code (PKCE)
model AuthorizationCode {
  id                  String   @id @default(cuid())
  code                String   @unique
  clientId            String
  userId              String
  redirectUri         String
  scope               String[]
  codeChallenge       String
  codeChallengeMethod String   @default("S256")
  resource            String?
  expiresAt           DateTime
  createdAt           DateTime @default(now())
  
  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("authorization_codes")
}

// Access Token (JWT)
model AccessToken {
  id        String   @id @default(cuid())
  token     String   @unique
  clientId  String
  userId    String
  scope     String[]
  resource  String?
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("access_tokens")
}

// Refresh Token
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
  
  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("refresh_tokens")
}
```

## 環境変数設定

### MCPサーバー (`.dev.vars`)

```bash
# OAuth 2.1 Configuration
MCP_ISSUER=http://localhost:8788
JWT_SECRET=your-secret-key-at-least-32-characters-long

# Google OAuth (ユーザー認証)
MCP_GOOGLE_CLIENT_ID=your-google-client-id
MCP_GOOGLE_CLIENT_SECRET=your-google-client-secret
MCP_GOOGLE_REDIRECT_URI=http://localhost:8788/auth/callback/google

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agent

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### AIサービス (`.dev.vars`) - オプション

```bash
# OAuth 2.1 Client Configuration
MCP_SERVER_URL=http://localhost:8788
MCP_CLIENT_ID=<from-dcr-registration>
MCP_CLIENT_SECRET=<if-confidential-client>

# その他の設定
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
# ...
```

## デプロイメント

### 開発環境

```bash
# MCPサーバー起動
cd packages/mcp-server
npm run dev
# → http://localhost:8788

# AIサービス起動 (オプション)
cd packages/agent
npm run dev
# → http://localhost:5173
```

### 本番環境

```bash
# MCPサーバーデプロイ
cd packages/mcp-server
wrangler secret put JWT_SECRET
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put DATABASE_URL
npm run deploy

# AIサービスデプロイ (オプション)
cd packages/agent
wrangler secret put MCP_CLIENT_SECRET
npm run deploy
```

## セキュリティベストプラクティス

### 実装済み

1. ✅ **PKCE (S256)** - 認可コード横取り防止
2. ✅ **JWT署名検証** - トークン改ざん防止
3. ✅ **スコープ検証** - 最小権限の原則
4. ✅ **短命トークン** - アクセストークン1時間
5. ✅ **HTTPS推奨** - 通信暗号化
6. ✅ **Redirect URI検証** - オープンリダイレクタ防止
7. ✅ **認可コード一回限り** - リプレイ攻撃防止
8. ✅ **State検証** - CSRF防止

### 推奨 (本番環境)

1. ⚠️ **強力なJWT_SECRET** - 32文字以上のランダム値
2. ⚠️ **RS256署名** - 公開鍵暗号の使用
3. ⚠️ **Rate Limiting** - DDoS対策
4. ⚠️ **監査ログ** - セキュリティイベント記録
5. 💡 **DPoP (RFC 9449)** - トークン盗難対策
6. 💡 **mTLS** - 相互認証

## 互換性

### 対応MCPクライアント

- ✅ Claude Desktop
- ✅ Cursor
- ✅ MCP Inspector
- ✅ 任意の標準OAuth 2.1クライアント

### RFC準拠

- ✅ RFC 6749 (OAuth 2.0)
- ✅ RFC 7636 (PKCE)
- ✅ RFC 7591 (DCR)
- ✅ RFC 8414 (AS Metadata)
- ✅ RFC 8707 (Resource Indicators)
- ✅ RFC 9728 (PRM)

## トラブルシューティング

### よくある問題

1. **401 Unauthorized**
   - JWT_SECRETが正しく設定されているか確認
   - トークンの有効期限を確認
   - スコープが正しいか確認

2. **invalid_client**
   - クライアントが登録されているか確認
   - redirect_uriが一致しているか確認

3. **invalid_grant**
   - 認可コードが期限切れでないか確認
   - PKCE verifierが正しいか確認

## 参考資料

- [MCP OAuth 2.1認証ガイド](../guides/MCP_AUTH_OAUTH2.md)
- [MCPサーバー README](../../packages/mcp-server/README.md)
- [セットアップガイド](../../packages/mcp-server/SETUP_OAUTH.md)
- [API仕様](../../packages/mcp-server/README_OAUTH.md)
- [MCP公式ドキュメント](https://modelcontextprotocol.io/docs/specification/authentication)

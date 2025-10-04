# MCP Server OAuth 2.1 Implementation

## Overview

MCP サーバーは OAuth 2.1 準拠の認可サーバーとして機能し、以下のエンドポイントを提供します:

- **Discovery**: `/.well-known/openid-configuration`
- **Authorization**: `/auth/authorize` (GET)
- **Token**: `/auth/token` (POST)
- **JWKS**: `/auth/jwks` (GET)

## サポートされているグラントタイプ

1. **Authorization Code with PKCE** (推奨)
2. **Refresh Token**
3. **Client Credentials**

## エンドポイントの使用方法

### 1. Authorization Code Flow with PKCE

#### Step 1: 認可コードの取得

```bash
# PKCE パラメータの生成
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n $CODE_VERIFIER | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | tr "/" "_")

# 認可エンドポイントにリダイレクト
curl -i "http://localhost:8788/auth/authorize?response_type=code&client_id=test_client&redirect_uri=http://localhost:3000/callback&scope=openid+profile+mcp.registry.read&state=random_state&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256"
```

レスポンス: `302 Found` で `redirect_uri` にリダイレクトされ、`code` パラメータが付与されます。

#### Step 2: アクセストークンの取得

```bash
# 認可コードからアクセストークンを取得
curl -X POST http://localhost:8788/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE_FROM_STEP1" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=test_client" \
  -d "code_verifier=$CODE_VERIFIER"
```

レスポンス例:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "a1b2c3d4e5f6...",
  "scope": "openid profile mcp.registry.read"
}
```

### 2. Refresh Token Flow

```bash
curl -X POST http://localhost:8788/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN"
```

### 3. Client Credentials Flow

```bash
curl -X POST http://localhost:8788/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret" \
  -d "scope=mcp.registry.read+mcp.discovery.read"
```

## 保護されたエンドポイントの呼び出し

取得したアクセストークンを使用して、保護されたエンドポイントにアクセスできます:

```bash
curl http://localhost:8788/mcp/registry \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## スコープ

以下のスコープがサポートされています:

- `openid` - OpenID Connect
- `profile` - ユーザープロファイル情報
- `mcp.registry.read` - MCP サーバーレジストリの読み取り
- `mcp.registry.write` - MCP サーバーレジストリの書き込み
- `mcp.discovery.read` - MCP サーバーディスカバリの読み取り
- `agent.session.manage` - エージェントセッションの管理

## 現在の制限事項と TODO

### ⚠️ 本番環境で対応が必要な項目

1. **認可コードとリフレッシュトークンの永続化**
   - 現在はメモリ内に保存 (Worker 再起動で消失)
   - D1 データベースに保存するモデルを追加する必要があります

2. **クライアント認証**
   - Client Credentials フローで適切なクライアント検証が未実装
   - クライアント情報を D1 に保存し、`client_secret` を検証する必要があります

3. **ユーザー認証**
   - 認可エンドポイントでユーザーログインフローが未実装
   - 現在は `userId: null` (匿名) でトークンを発行
   - Google OAuth などの外部認証プロバイダと連携する必要があります

4. **JWKS エンドポイント**
   - 現在は空の配列を返すだけ
   - 公開鍵情報を返すように実装する必要があります

5. **レート制限とセキュリティ**
   - ブルートフォース攻撃対策
   - トークン発行の制限
   - CORS の適切な設定

## データベーススキーマの提案

以下のテーブルを追加することを推奨します:

```sql
-- OAuth クライアント
CREATE TABLE OAuthClient (
  id TEXT PRIMARY KEY,
  clientSecret TEXT NOT NULL,
  name TEXT NOT NULL,
  redirectUris TEXT NOT NULL, -- JSON array
  allowedScopes TEXT NOT NULL, -- JSON array
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- 認可コード
CREATE TABLE OAuthAuthorizationCode (
  code TEXT PRIMARY KEY,
  clientId TEXT NOT NULL,
  userId TEXT,
  redirectUri TEXT NOT NULL,
  scope TEXT NOT NULL,
  codeChallenge TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (clientId) REFERENCES OAuthClient(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- リフレッシュトークン
CREATE TABLE OAuthRefreshToken (
  token TEXT PRIMARY KEY,
  clientId TEXT NOT NULL,
  userId TEXT NOT NULL,
  scope TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (clientId) REFERENCES OAuthClient(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- インデックス
CREATE INDEX idx_auth_code_expires ON OAuthAuthorizationCode(expiresAt);
CREATE INDEX idx_refresh_token_expires ON OAuthRefreshToken(expiresAt);
```

## テスト

開発環境でのテスト用スクリプト:

```bash
# packages/mcp-server ディレクトリで実行
npm run dev

# 別のターミナルで
cd packages/mcp-server
./test-oauth.sh  # テストスクリプトを作成する必要があります
```

## 環境変数

`.dev.vars` に以下の環境変数を設定してください:

```
JWT_SECRET=your-secret-key-here
MCP_ISSUER=http://localhost:8788
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

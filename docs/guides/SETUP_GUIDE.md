# セットアップガイド - 分離アーキテクチャ

このガイドでは、AIサービスとMCPサーバーを分離した新しいアーキテクチャのセットアップ方法を説明します。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│  AI Service (localhost:8787)                        │
│  - ユーザー認証 (Google/LINE OAuth)                  │
│  - AIエージェント (LangGraph)                        │
│  - MCP トークン発行                                  │
└──────────────┬──────────────────────────────────────┘
               │ Bearer Token (JWT)
               ▼
┌─────────────────────────────────────────────────────┐
│  MCP Server (localhost:8788)                        │
│  - トークン検証                                       │
│  - ビジネスツール (予約/商品/注文/フォーム)            │
│  - 管理者認証 (Google OAuth)                         │
└─────────────────────────────────────────────────────┘
```

## 🔑 RSA鍵ペアの生成

AIサービスとMCPサーバー間の通信には、RS256アルゴリズムを使用したJWTトークンを使用します。

### 1. 秘密鍵の生成 (AI Service用)

```powershell
# 秘密鍵を生成
openssl genrsa -out private_key.pem 2048

# 秘密鍵の内容を確認
cat private_key.pem
```

### 2. 公開鍵の抽出 (MCP Server用)

```powershell
# 秘密鍵から公開鍵を抽出
openssl rsa -in private_key.pem -pubout -out public_key.pem

# 公開鍵の内容を確認
cat public_key.pem
```

## 📦 インストール

### 1. AI Service のセットアップ

```powershell
cd packages/agent

# 依存関係のインストール
npm install

# 環境変数ファイルのコピー
cp .dev.vars.example .dev.vars

# .dev.vars を編集
notepad .dev.vars
```

`.dev.vars` に以下を設定:
```env
OPENAI_API_KEY=sk-your-openai-api-key
DATABASE_URL=postgresql://user:password@localhost:5432/agent
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback/google

# 秘密鍵の内容をそのままペースト (改行は\nに変換)
MCP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"

MCP_SERVER_URL=http://localhost:8788
```

### 2. MCP Server のセットアップ

```powershell
cd packages/mcp-server

# 依存関係のインストール
npm install

# 環境変数ファイルのコピー
cp .dev.vars.example .dev.vars

# .dev.vars を編集
notepad .dev.vars
```

`.dev.vars` に以下を設定:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/agent

# MCP管理者用のGoogle OAuth (AI Serviceとは別のCredentials推奨)
MCP_GOOGLE_CLIENT_ID=your-mcp-google-client-id
MCP_GOOGLE_CLIENT_SECRET=your-mcp-google-client-secret
MCP_GOOGLE_REDIRECT_URI=http://localhost:8788/auth/callback/google

# 公開鍵の内容をそのままペースト (改行は\nに変換)
AI_SERVICE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
...
-----END PUBLIC KEY-----"

ALLOWED_ORIGINS=http://localhost:8787,http://localhost:5173
```

### 3. データベースのセットアップ

```powershell
cd packages/database

# Prismaクライアント生成
npm run generate

# スキーマをDBにプッシュ
npm run push

# サンプルデータ投入 (オプション)
npm run seed
```

## 🚀 起動

### ターミナル1: AI Service

```powershell
cd packages/agent
npm run dev
```

http://localhost:8787 でアクセス可能

### ターミナル2: MCP Server

```powershell
cd packages/mcp-server
npm run dev
```

http://localhost:8788 でアクセス可能

### ターミナル3: Prisma Studio (オプション)

```powershell
cd packages/database
npm run studio
```

http://localhost:5555 でデータベースを閲覧

## 🧪 動作確認

### 1. AI Service の認証テスト

```powershell
# ブラウザで開く
start http://localhost:8787

# Google OAuth ログイン
start http://localhost:8787/auth/login/google
```

### 2. MCP Token 発行テスト

```powershell
# ログイン後、トークンを取得
curl http://localhost:8787/auth/mcp-token `
  -X POST `
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

レスポンス例:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 3. MCP Server へのアクセステスト

```powershell
# 公開エンドポイント (認証不要)
curl http://localhost:8788/mcp/tools/product/search?q=test

# 認証が必要なエンドポイント (トークン必要)
$token = "YOUR_MCP_TOKEN"
curl http://localhost:8788/mcp/tools/booking/create `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{\"serviceId\": \"srv_123\", \"date\": \"2025-10-15\", \"time\": \"10:00\"}'
```

### 4. MCP 管理者認証テスト

```powershell
# ブラウザで開く
start http://localhost:8788/auth/login/google
```

## 🔧 トラブルシューティング

### トークン検証エラー

**症状**: MCP Serverで "Invalid token" エラー

**解決策**:
1. 秘密鍵と公開鍵のペアが正しいか確認
2. 鍵のフォーマットが正しいか確認 (BEGIN/END行を含む)
3. 改行文字が `\n` に変換されているか確認

```powershell
# 鍵ペアの検証
openssl rsa -in private_key.pem -check
openssl rsa -in private_key.pem -pubout | diff - public_key.pem
```

### CORS エラー

**症状**: ブラウザコンソールに CORS エラー

**解決策**:
1. MCP Server の `ALLOWED_ORIGINS` に AI Service の URL を追加
2. 両方のサーバーが起動しているか確認

### データベース接続エラー

**症状**: Database connection failed

**解決策**:
1. PostgreSQLが起動しているか確認
2. `DATABASE_URL` が正しいか確認
3. データベースが存在するか確認

```powershell
# PostgreSQL接続テスト
psql $env:DATABASE_URL
```

## 📚 次のステップ

- [MCP Authentication Guide](./MCP_AUTH.md) - 認証システムの詳細
- [Separation Architecture](../architecture/SEPARATION_ARCHITECTURE.md) - アーキテクチャの詳細
- [MCP Usage Guide](./MCP_USAGE.md) - MCPツールの使い方

## 🔐 本番環境への展開

### Cloudflare Workers へのデプロイ

**AI Service**:
```powershell
cd packages/agent

# Secretsの設定
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MCP_PRIVATE_KEY
wrangler secret put DATABASE_URL

# デプロイ
npm run deploy
```

**MCP Server**:
```powershell
cd packages/mcp-server

# Secretsの設定
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put AI_SERVICE_PUBLIC_KEY
wrangler secret put DATABASE_URL

# デプロイ
npm run deploy
```

### 環境変数の更新

本番環境では、URLを本番ドメインに変更:
- `GOOGLE_REDIRECT_URI`: `https://your-domain.com/auth/callback/google`
- `MCP_SERVER_URL`: `https://mcp.your-domain.com`
- `ALLOWED_ORIGINS`: `https://your-domain.com`

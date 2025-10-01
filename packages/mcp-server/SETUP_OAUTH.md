# MCP OAuth 2.1 セットアップガイド

## 📋 前提条件

- Node.js 18以上
- PostgreSQL 14以上
- Google OAuth クライアント (https://console.cloud.google.com/)

## 🚀 セットアップ手順

### 1. データベースの起動

PostgreSQLを起動してください:

```bash
# Dockerを使用する場合
docker run -d \
  --name agent-postgres \
  -e POSTGRES_USER=agent \
  -e POSTGRES_PASSWORD=agent \
  -e POSTGRES_DB=agent_db \
  -p 5432:5432 \
  postgres:14
```

### 2. Google OAuth クライアントの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. 「APIとサービス」→「OAuth同意画面」で設定
4. 「認証情報」→「認証情報を作成」→「OAuthクライアントID」
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのリダイレクトURI: `http://localhost:8788/auth/callback/google`
5. クライアントIDとシークレットをコピー

### 3. 環境変数の設定

```bash
cd packages/mcp-server
cp .dev.vars.example .dev.vars
```

`.dev.vars` を編集:

```bash
# OAuth 2.1 Configuration
MCP_ISSUER=http://localhost:8788
JWT_SECRET=<32文字以上のランダムな文字列を生成>

# Google OAuth
MCP_GOOGLE_CLIENT_ID=<GoogleコンソールからコピーしたクライアントID>
MCP_GOOGLE_CLIENT_SECRET=<Googleコンソールからコピーしたシークレット>
MCP_GOOGLE_REDIRECT_URI=http://localhost:8788/auth/callback/google

# Database
DATABASE_URL=postgresql://agent:agent@localhost:5432/agent_db

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

JWT_SECRETの生成例:
```bash
# Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# またはopensslで生成
openssl rand -base64 32
```

### 4. データベースマイグレーション

```bash
cd ../database
npx prisma migrate dev --name oauth2_standard_implementation
npx prisma generate
```

### 5. MCPサーバー起動

```bash
cd ../mcp-server
npm run dev
```

サーバーが `http://localhost:8788` で起動します。

### 6. 動作確認

#### メタデータエンドポイントの確認

```bash
# Authorization Server Metadata
curl http://localhost:8788/.well-known/oauth-authorization-server | jq

# Protected Resource Metadata  
curl http://localhost:8788/.well-known/oauth-protected-resource | jq
```

#### 401レスポンスの確認

```bash
curl -v http://localhost:8788/mcp/tools/booking
```

WWW-Authenticateヘッダが返されることを確認:
```
< HTTP/1.1 401 Unauthorized
< WWW-Authenticate: Bearer resource_metadata="http://localhost:8788/.well-known/oauth-protected-resource"
```

## 🧪 OAuth 2.1フローのテスト

### 1. クライアント登録

```bash
curl -X POST http://localhost:8788/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["http://localhost:3000/callback"]
  }' | jq
```

レスポンス例:
```json
{
  "client_id": "cm7x8y9z0-abcd-1234-efgh-ijklmnopqrst",
  "client_name": "Test Client",
  "redirect_uris": ["http://localhost:3000/callback"]
}
```

**client_idを保存しておいてください。**

### 2. PKCE Code Verifier/Challengeの生成

```bash
# Code Verifierの生成 (43-128文字のランダム文字列)
CODE_VERIFIER=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
echo "Code Verifier: $CODE_VERIFIER"

# Code Challenge の生成 (SHA256ハッシュのBase64URL)
CODE_CHALLENGE=$(node -e "const crypto = require('crypto'); const verifier = '$CODE_VERIFIER'; const hash = crypto.createHash('sha256').update(verifier).digest('base64url'); console.log(hash)")
echo "Code Challenge: $CODE_CHALLENGE"
```

### 3. 認可リクエスト (ブラウザで実行)

以下のURLをブラウザで開く:

```
http://localhost:8788/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback&scope=booking:read%20product:read&state=random-state-12345&code_challenge=YOUR_CODE_CHALLENGE&code_challenge_method=S256&resource=http://localhost:8788
```

**置き換え:**
- `YOUR_CLIENT_ID`: 手順1で取得したclient_id
- `YOUR_CODE_CHALLENGE`: 手順2で生成したCode Challenge

Google OAuthにリダイレクトされるので、ログインして承認します。

### 4. 認可コードの取得

リダイレクト先のURL (http://localhost:3000/callback?code=XXX&state=random-state-12345) からcodeパラメータを取得します。

### 5. アクセストークンの取得

```bash
curl -X POST http://localhost:8788/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_AUTHORIZATION_CODE&redirect_uri=http://localhost:3000/callback&client_id=YOUR_CLIENT_ID&code_verifier=$CODE_VERIFIER" | jq
```

レスポンス例:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "uuid-refresh-token",
  "scope": "booking:read product:read"
}
```

### 6. API呼び出し

```bash
ACCESS_TOKEN="<上記で取得したaccess_token>"

# MCP Tools一覧
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:8788/mcp/tools | jq

# Booking API
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:8788/mcp/tools/booking | jq
```

## 🔧 トラブルシューティング

### データベース接続エラー

```
Error: P1001: Can't reach database server
```

→ PostgreSQLが起動していることを確認:
```bash
docker ps | grep postgres
```

### Google OAuth エラー

```
redirect_uri_mismatch
```

→ Google Cloud ConsoleでリダイレクトURIが正しく設定されているか確認

### JWT検証エラー

```
invalid_token
```

→ JWT_SECRETが正しく設定されているか確認

### CORS エラー

→ ALLOWED_ORIGINSに正しいオリジンが含まれているか確認

## 📚 次のステップ

- [README_OAUTH.md](./README_OAUTH.md) - 詳細なAPI仕様
- [MCP公式ドキュメント](https://modelcontextprotocol.io/docs/specification/authentication)
- MCPクライアント (Claude Desktop, Cursor) の設定

## 🎯 本番環境デプロイ

1. **強力なJWT_SECRET**を設定
2. **HTTPS**を有効化
3. **CORS**を特定のオリジンに制限
4. **MCP_ISSUER**を本番URLに変更
5. Google OAuth のリダイレクトURIを本番URLに更新
6. データベースの接続情報を本番環境用に更新

Cloudflare Workersへのデプロイ:

```bash
# Secretsの設定
wrangler secret put JWT_SECRET
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put DATABASE_URL

# デプロイ
npm run deploy
```

# Agent App

Vite + SolidJS + Cloudflare Workers + Hono + D1 の AI エージェント アプリケーション

## 🗄️ データベース

このアプリケーションは **Cloudflare D1**（SQLite ベース）を使用しています。

- データベース名: `agent-db`
- バインディング: `DB`
- マイグレーション: `packages/database/migrations/`

詳細は [`../../D1_MIGRATION.md`](../../D1_MIGRATION.md) を参照してください。

## 開発環境のセットアップ

### 1. 依存関係のインストール
```powershell
# ルートディレクトリから
npm install
```

### 2. D1 データベースの初期化（初回のみ）
```powershell
# packages/agent ディレクトリから
npx wrangler d1 execute agent-db --local --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --local --file=../database/migrations/0002_add_oauth_state.sql

# 確認
npx wrangler d1 execute agent-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 3. Prisma Client の生成
```powershell
# ルートディレクトリから
npm run db:generate
```

### 4. 環境変数の設定

`.dev.vars` ファイルを編集し、必要な環境変数を設定してください:

```env
# Google OAuth (必須)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/auth/callback/google

# JWT設定
JWT_SECRET=your-secure-random-string

# OpenAI API Key (AI機能用)
OPENAI_API_KEY=sk-...

# Stripe (決済機能用、オプション)
STRIPE_SECRET_KEY=sk_test_...
```

### 5. 開発サーバーの起動

```powershell
npm run dev
```

アプリケーションは以下のURLでアクセスできます:
- フロントエンド: `http://localhost:3000`
- Worker API: `http://localhost:8787`

Viteが自動的に `/api` リクエストをWorkerにプロキシします（`vite.config.ts` で設定）。

## ビルドとデプロイ

### ローカルビルド
```powershell
npm run build
```

### Cloudflareにデプロイ

1. **本番D1データベースの作成**（初回のみ）:
```powershell
npx wrangler d1 create agent-db
# 出力されたdatabase_idをwrangler.tomlに設定
```

2. **マイグレーションの適用**:
```powershell
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0002_add_oauth_state.sql
```

3. **環境変数の設定**:
```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
```

4. **デプロイ**:
```powershell
npm run deploy
```

## API エンドポイント

- `GET /api/hello` - Hello Worldメッセージ
- `GET /api/status` - アプリケーションステータス

## 技術スタック

- **Frontend**: Vite + SolidJS
- **Backend**: Cloudflare Workers + Hono
- **Language**: TypeScript

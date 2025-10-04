# D1 Migration Guide

このプロジェクトは **Cloudflare D1**（SQLite）を使用しています。PostgreSQLからの移行が完了しています。

## D1データベースの設定状況

### ✅ 完了している設定

1. **Prisma Schema**: SQLite用に設定済み（`packages/database/prisma/schema.prisma`）
2. **Wrangler設定**: 両方のWorkerでD1バインディング設定済み
   - `packages/agent/wrangler.toml`
   - `packages/mcp-server/wrangler.toml`
3. **Prismaアダプター**: `@prisma/adapter-d1`を使用
4. **依存関係**: PostgreSQL関連パッケージを削除済み

### データベースバインディング

両方のWorkerで以下のD1バインディングが設定されています:

```toml
[[d1_databases]]
binding = "DB"
database_name = "agent-db"
database_id = "5d37dc65-7771-4e1a-bd9f-18d271fef90b"
```

## 開発環境のセットアップ

### 1. D1データベースの初期化

最初に、ローカルD1データベースを初期化します:

```powershell
# agentパッケージのマイグレーション適用
cd packages\agent
npx wrangler d1 execute agent-db --local --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --local --file=../database/migrations/0002_add_oauth_state.sql

# 確認
npx wrangler d1 execute agent-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 2. Prisma Clientの生成

スキーマを変更した場合は、Prisma Clientを再生成します:

```powershell
# ルートディレクトリから
npm run db:generate
```

### 3. 環境変数の設定

`.dev.vars`ファイルを各パッケージで設定してください:

- `packages/agent/.dev.vars`
- `packages/mcp-server/.dev.vars`

サンプルファイルが既に作成されています。必要な値を設定してください。

## 開発コマンド

```powershell
# 開発サーバー起動（agent）
npm run dev:agent

# 開発サーバー起動（mcp-server）
npm run dev:mcp

# Prisma Studio（データ確認用）
npm run db:studio --workspace=packages/database
```

## マイグレーション管理

### 新しいマイグレーションの作成

Prismaスキーマを変更した後:

```powershell
cd packages\database

# 1. SQLファイルを手動作成
# migrations/XXXX_description.sql

# 2. D1に適用（ローカル）
cd ..\agent
npx wrangler d1 execute agent-db --local --file=../database/migrations/XXXX_description.sql

# 3. D1に適用（本番）
npx wrangler d1 execute agent-db --remote --file=../database/migrations/XXXX_description.sql

# 4. Prisma Clientを再生成
cd ..\..
npm run db:generate
```

### 既存のマイグレーション

1. `0001_init.sql` - 初期スキーマ（全テーブル作成）
2. `0002_add_oauth_state.sql` - OAuthStateテーブル追加

## 本番環境へのデプロイ

### 1. 本番D1データベースの作成

```powershell
npx wrangler d1 create agent-db
```

### 2. マイグレーション適用

```powershell
cd packages\agent
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0002_add_oauth_state.sql
```

### 3. 環境変数の設定

```powershell
# Agent Worker
cd packages\agent
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY

# MCP Server
cd ..\mcp-server
npx wrangler secret put JWT_SECRET
npx wrangler secret put MCP_GOOGLE_CLIENT_ID
npx wrangler secret put MCP_GOOGLE_CLIENT_SECRET
```

### 4. デプロイ

```powershell
# Agent
npm run deploy --workspace=packages/agent

# MCP Server
npm run deploy --workspace=packages/mcp-server
```

## D1の特徴と制約

### 利点
- ✅ Cloudflare Workersとのネイティブ統合
- ✅ グローバルエッジでの低レイテンシー
- ✅ 無料プランあり（5GB、500万読み取り/日）
- ✅ SQLite互換性

### 制約
- ⚠️ SQLiteベースのため、一部のPostgreSQL機能は使えません
- ⚠️ 書き込みは1リージョンのみ（読み取りはグローバル複製）
- ⚠️ トランザクションサイズに制限あり（1000ステートメント）

## トラブルシューティング

### D1データベースが見つからない

```powershell
# ローカルD1の状態確認
npx wrangler d1 list

# ローカルデータのクリア
rm -r .wrangler/state
```

### マイグレーションの状態確認

```powershell
# ローカル
npx wrangler d1 execute agent-db --local --command="SELECT * FROM sqlite_master WHERE type='table';"

# 本番
npx wrangler d1 execute agent-db --remote --command="SELECT * FROM sqlite_master WHERE type='table';"
```

### Prisma Clientのエラー

```powershell
# Prisma Clientを再生成
npm run db:generate

# キャッシュクリア
rm -r packages/database/node_modules/.prisma
npm install
```

## 参考リンク

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Prisma + D1 Integration](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)

# D1完全移行完了チェックリスト

✅ **完了した設定**

## 1. データベース設定

- ✅ Prisma Schema を SQLite (D1) 用に設定
  - `datasource db { provider = "sqlite" }`
  - `previewFeatures = ["driverAdapters"]`
  
- ✅ wrangler.toml で D1 バインディングを設定
  - `packages/agent/wrangler.toml`
  - `packages/mcp-server/wrangler.toml`
  - Database name: `agent-db`
  - Binding: `DB`

## 2. 依存関係

- ✅ `@prisma/adapter-d1` をインストール済み
- ✅ `@prisma/client` をインストール済み
- ✅ PostgreSQL 関連パッケージを削除済み（`pg`, `@prisma/adapter-pg`）

## 3. Prisma Utility

- ✅ `packages/agent/worker/utils/prisma.ts` - D1 アダプター使用
- ✅ `packages/mcp-server/worker/utils/prisma.ts` - D1 アダプター使用

## 4. マイグレーション

- ✅ `packages/database/migrations/0001_init.sql` - 初期スキーマ
- ✅ `packages/database/migrations/0002_add_oauth_state.sql` - OAuthState追加
- ✅ ローカル D1 にマイグレーション適用済み

## 5. ドキュメント

- ✅ `D1_MIGRATION.md` - 完全な移行ガイド
- ✅ `README.md` - D1 使用を明記
- ✅ `packages/agent/README.md` - D1 セットアップ手順
- ✅ `.github/copilot-instructions.md` - D1 開発ガイド

## 6. 環境変数

- ✅ `packages/agent/.dev.vars` - DATABASE_URL 不要（D1 バインディング使用）
- ✅ `packages/mcp-server/.dev.vars` - 同上

## 確認済みの動作

```powershell
# テーブル一覧の確認
cd packages\agent
npx wrangler d1 execute agent-db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# 結果（15テーブル）:
# - AgentMcpLink
# - AgentSession
# - ConversationMessage
# - McpServer
# - McpServerTag
# - OAuthAccessToken
# - OAuthAccount
# - OAuthAuthorizationCode
# - OAuthClient
# - OAuthRefreshToken
# - OAuthState
# - User
# - _cf_METADATA
# - d1_migrations
# - sqlite_sequence
```

## 次のステップ

### 開発を開始する場合

```powershell
# 1. 依存関係のインストール（初回のみ）
npm install

# 2. Prisma Client の生成
npm run db:generate

# 3. 開発サーバーの起動
npm run dev:agent
```

### 新しいマイグレーションを作成する場合

```powershell
# 1. Prisma スキーマを編集
# packages/database/prisma/schema.prisma

# 2. SQL マイグレーションファイルを作成
# packages/database/migrations/XXXX_description.sql

# 3. ローカルに適用
cd packages\agent
npx wrangler d1 execute agent-db --local --file=../database/migrations/XXXX_description.sql

# 4. Prisma Client を再生成
cd ..\..
npm run db:generate
```

### 本番環境にデプロイする場合

```powershell
# 1. 本番 D1 データベースが存在しない場合は作成
npx wrangler d1 create agent-db

# 2. マイグレーションを本番に適用
cd packages\agent
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --remote --file=../database/migrations/0002_add_oauth_state.sql

# 3. 環境変数を設定
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# その他必要なシークレット...

# 4. デプロイ
npm run deploy
```

## PostgreSQL からの完全移行

このプロジェクトは PostgreSQL から Cloudflare D1 (SQLite) への移行が完了しています。

### 主な変更点

| 項目 | PostgreSQL（旧） | D1（新） |
|------|----------------|----------|
| データベース | PostgreSQL | Cloudflare D1 (SQLite) |
| アダプター | `@prisma/adapter-pg` | `@prisma/adapter-d1` |
| 接続方法 | 接続文字列（DATABASE_URL） | Wrangler バインディング（DB） |
| マイグレーション | Prisma Migrate | 手動 SQL + Wrangler |
| ホスティング | 外部 PostgreSQL サーバー | Cloudflare エッジ |
| コスト | 有料プラン必須 | 無料プラン利用可能 |

### D1 の利点

1. **Cloudflare Workers との統合**: ネイティブサポート、追加設定不要
2. **グローバルエッジ**: 世界中で低レイテンシー
3. **コスト効率**: 無料プランで5GB、500万読み取り/日
4. **シンプル**: 接続文字列不要、バインディングだけで動作
5. **スケーラビリティ**: Cloudflare のインフラで自動スケール

### 制約事項

1. **SQLite ベース**: PostgreSQL 固有の機能（配列型、JSON 演算子など）は使えません
2. **書き込み制限**: 書き込みは1リージョンのみ（読み取りはグローバル複製）
3. **トランザクションサイズ**: 1000ステートメントまで

これらの制約は、エッジコンピューティングのユースケースでは通常問題になりません。

---

## 🎉 完了！

プロジェクトは完全に Cloudflare D1 に移行されました。
開発を開始するには `npm run dev:agent` を実行してください。

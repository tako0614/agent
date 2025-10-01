# Changelog

## 2025-10-01 - MCP_API_KEY廃止とアカウント管理ツール実装

### 変更内容

#### MCP_API_KEYの廃止
- MCP_API_KEYによるAPI認証を削除
- セッションベースの認証のみに統一
- より安全でシンプルな認証フローに改善

#### アカウント管理ツールの追加
AIエージェントから直接アカウント管理ができるようになりました:

**account_tool** の追加:
- `register` - 新規アカウント作成
- `login` - ログイン
- `get_profile` - プロフィール取得
- `update` - アカウント情報更新
- `delete` - アカウント削除
- `logout` - ログアウト

#### エンドポイントの変更
- `/mcp/account/register` → `/mcp/account/register` (変更なし)
- `/mcp/account/login` → `/mcp/account/login` (新規追加)
- `/mcp/account/me` → `/mcp/account/me` (middlewareを使用)
- `/mcp/account/update` → `/mcp/account/update` (middlewareを使用)
- `/mcp/account/delete` → `/mcp/account/delete` (middlewareを使用)
- `/mcp/account/logout` → `/mcp/account/logout` (新規追加)

#### 削除された機能
- Admin専用のAPI Key認証
- `/mcp/account/list` (Admin機能)
- `/mcp/account/:userId/role` (Admin機能)
- `/mcp/account/:userId` (Admin機能)

### 使用例

```typescript
// アカウントを作成
const result = await agent.chat("新しいアカウントを作成してください。メールは test@example.com、名前は Test User、パスワードは password123 です");

// ログイン
const loginResult = await agent.chat("test@example.com でログインしてください。パスワードは password123 です");

// プロフィール取得
const profileResult = await agent.chat("私のプロフィール情報を表示してください");
```

### マイグレーション

環境変数から `MCP_API_KEY` を削除してください:
- `.dev.vars` ファイル
- `wrangler.toml` の secrets設定
- Cloudflare Dashboard の環境変数設定

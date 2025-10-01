# Changelog

## 2025-10-02 - Chat/Agent/Autoモード実装

### 新機能: 3つの動作モード

AIエージェントに3つの動作モードが追加されました:

#### 💬 Chat モード
- **用途**: シンプルな質問応答
- 情報取得、説明、相談など
- 素早く応答が欲しい場合に最適

#### 🤖 Agent モード
- **用途**: 自律型AIエージェント
- タスクを自動的に計画に分解
- **フロー**: 指示 → 計画 → 実行 → 成果物
- 実行ステップの可視化
- 複雑なタスクを段階的に処理

#### ✨ Auto モード
- **用途**: 自動切り替え
- メッセージ内容を分析して最適なモードを自動選択
- シンプルな質問 → Chatモード
- 複雑なタスク → Agentモード

### UI追加

#### ModeSelector コンポーネント
- ヘッダーにモード切り替えボタンを追加
- 現在のモードを視覚的に表示
- モード説明を表示

#### AgentSteps コンポーネント
- Agentモードで実行計画を表示
- ステップの進捗状況を可視化:
  - ✅ 完了 (緑)
  - 🔄 実行中 (青、アニメーション)
  - ⏳ 未実行 (グレー)

#### MessageBubble 拡張
- メッセージにモード情報を表示
- Agentモードの実行計画を統合表示

### バックエンド実装

#### modes.ts (新規)
- `determineMode()`: 自動モード判定
- `createPlan()`: 実行計画の作成
- `executeAgentMode()`: Agentモードの実行ロジック
- `executeChatMode()`: Chatモードの実行ロジック

#### APIレスポンス拡張
```typescript
{
  mode: 'chat' | 'agent' | 'auto',
  planSteps?: string[],      // 実行計画のステップ
  currentStep?: number,       // 現在のステップ番号
  toolCalls?: Array<{...}>   // 実行されたツール呼び出し
}
```

### 型定義の追加

```typescript
export type AgentMode = 'chat' | 'agent' | 'auto';

interface Message {
  // ... 既存のフィールド
  mode?: AgentMode;
  planSteps?: string[];
  currentStep?: number;
}
```

### 使用例

#### Chatモード
```
ユーザー: 「予約システムとは何ですか?」
AI: [シンプルに説明]
```

#### Agentモード
```
ユーザー: 「ECサイトを作成して、商品を3つ追加して」

実行計画:
1. ✅ ECサービスの初期化
2. ✅ 商品データの準備  
3. 🔄 商品の登録
4. ⏳ 動作確認
5. ⏳ 結果報告

AI: [各ステップを順次実行し、最終結果を報告]
```

#### Autoモード
```
ユーザー: 「商品の価格を教えて」
→ 自動的にChatモードを選択

ユーザー: 「フォームを作成して、テストデータを送信して」
→ 自動的にAgentモードを選択
```

### ドキュメント

- `docs/guides/MODES.md` - 詳細な使用ガイドを追加
- 各モードの用途、使い方、技術詳細を記載

### 変更ファイル

**Frontend:**
- `src/types/index.ts` - AgentMode型追加
- `src/components/ModeSelector.tsx` - 新規作成
- `src/components/AgentSteps.tsx` - 新規作成
- `src/components/MessageBubble.tsx` - モード表示対応
- `src/App.tsx` - モード切り替えロジック追加

**Backend:**
- `worker/ai/modes.ts` - 新規作成
- `worker/api/index.ts` - モード処理対応

---

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

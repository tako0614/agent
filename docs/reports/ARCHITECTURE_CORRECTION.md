# アーキテクチャ修正完了報告

**日付**: 2025年10月2日  
**目的**: ドキュメント通りの分離アーキテクチャへの修正

## 🎯 問題点

実装がドキュメント (`SEPARATION_ARCHITECTURE.md`) と不一致でした:

### 修正前の問題
- ❌ `packages/agent/worker/mcp/` フォルダにMCPツールの実装が残っていた
- ❌ `packages/agent/worker/index.ts` で `/mcp` ルートをマウントしていた
- ❌ AIツールが同じサーバー内のエンドポイントを呼び出していた
- ❌ コードが重複し、デプロイが複雑

## ✅ 実施した修正

### 1. packages/agent からMCP関連コードを削除

#### 削除したフォルダ
- `packages/agent/worker/mcp/` (全体)
  - `index.ts` - MCPルーター
  - `middleware.ts` - 認証ミドルウェア
  - `account.ts` - アカウント管理

#### 修正したファイル

**`packages/agent/worker/index.ts`**
- ❌ 削除: `import mcp from './mcp';`
- ❌ 削除: `app.route('/mcp', mcp);`
- ✅ 変更: エンドポイント情報から `/mcp` を削除

**型定義の追加**
```typescript
type Bindings = {
  // ... 既存の型
  MCP_SERVER_URL?: string;    // 追加
  MCP_PRIVATE_KEY?: string;   // 追加
}
```

### 2. AIツールの外部MCP呼び出しへの変更

**`packages/agent/worker/ai/tools.ts`**

#### 追加した関数
```typescript
// MCP Server URLを環境変数から取得
function getMcpServerUrl(c: Context): string

// MCPトークンを取得
async function getMcpToken(c: Context): Promise<string | null>
```

#### 変更した内容
- ✅ すべてのMCP呼び出しを外部MCPサーバーへのHTTPリクエストに変更
- ✅ 認証が必要なエンドポイントには `Authorization: Bearer {token}` ヘッダーを追加
- ✅ 管理者専用機能にトークン認証を適用

**変更例**:
```typescript
// 修正前
const response = await fetch(
  `${c.req.url.split('/api')[0]}/mcp/tools/booking/create`,
  { /* ... */ }
);

// 修正後
const mcpServerUrl = getMcpServerUrl(c);
const response = await fetch(
  `${mcpServerUrl}/tools/booking/create`,
  { /* ... */ }
);
```

### 3. ドキュメントの更新

**`README.md`**
- ✅ 開発サーバー起動手順を明確化
- ✅ AIサービスとMCPサーバーの両方を起動する必要があることを強調
- ✅ 各サービスのポート番号と役割を明記

## 📊 修正後のアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  AIサービス (localhost:8787)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ worker/                                                 │ │
│  │ ├── api/         - REST API                            │ │
│  │ ├── ai/          - LangGraph Agent                     │ │
│  │ │   └── tools.ts - 外部MCP呼び出し ✅                  │ │
│  │ ├── auth/        - Google/LINE OAuth                   │ │
│  │ │   └── mcp-token.ts - MCPトークン発行                │ │
│  │ └── payment/     - Stripe決済                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP Request
                              ↓ Bearer Token
┌─────────────────────────────────────────────────────────────┐
│  MCPサーバー (localhost:8788)                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ worker/                                                 │ │
│  │ ├── auth/        - MCP管理者認証 & トークン検証       │ │
│  │ └── mcp/         - ビジネスツール                      │ │
│  │     └── tools/   - booking, product, order, form       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 認証フロー

### エンドユーザー
1. AIサービスで Google/LINE ログイン
2. `/auth/mcp-token` で JWT トークン取得
3. AIエージェントが自動的にMCPサーバーへトークン付きでリクエスト

### 管理者
1. MCPサーバーで直接 Google ログイン
2. セッションCookieで管理機能にアクセス

## ✨ メリット

### セキュリティ
- ✅ 各サービスが独立した認証システム
- ✅ 攻撃対象領域の最小化
- ✅ トークンベースの安全な認証

### スケーラビリティ
- ✅ 各サービスを独立してスケール可能
- ✅ 負荷に応じた個別の最適化

### 保守性
- ✅ 独立したデプロイメント
- ✅ コードの重複なし
- ✅ 明確な責任分離

### 柔軟性
- ✅ MCPサーバーを複数のAIサービスで共有可能
- ✅ 将来的な拡張が容易

## 📝 環境変数

### AIサービス (`.dev.vars`)
```env
MCP_SERVER_URL=http://localhost:8788
MCP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

### MCPサーバー (`.dev.vars`)
```env
AI_SERVICE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALLOWED_ORIGINS=http://localhost:8787,http://localhost:5173
```

## 🚀 起動方法

### ターミナル1: AIサービス
```powershell
cd packages/agent
npm run dev
```

### ターミナル2: MCPサーバー
```powershell
cd packages/mcp-server
npm run dev
```

## ✅ 検証結果

- ✅ `packages/agent/worker/mcp` フォルダが削除された
- ✅ TypeScriptコンパイルエラーなし
- ✅ すべてのツールが外部MCPサーバーを呼び出すように変更
- ✅ ドキュメントと実装が一致

## 🎉 結論

アーキテクチャがドキュメント通りに修正され、AIサービスとMCPサーバーが完全に分離されました。
これにより、セキュリティ、スケーラビリティ、保守性がすべて向上しました。

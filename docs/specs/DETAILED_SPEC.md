# AI Agent Detailed Specifications

本ドキュメントは、モノレポ内の各コンポーネントに関する詳細仕様をまとめ、`docs/planning/PLAN.md` で定義された高レベル計画を補完する。開発者は本書を参照してデータモデル、API、ワーカー構成、LangGraph フロー等の細部を実装する。

---

## 1. パッケージ別コンポーネント仕様

### 1.1 `packages/agent`
- **役割**: SolidJS UI（Vite）と Cloudflare Worker (Hono) を組み合わせたエージェントアプリ。
- **主要責務**:
  - チャット UI、MCP 連携 GUI（将来拡張）
  - LangGraph ベースのエージェント実行（`/api/agent/*` エンドポイント）
  - MCP 管理用 API (`/api/mcp/*`)
- **主なディレクトリ**:
  - `src/`: SolidJS フロントエンド（チャット UI、状態管理）
  - `worker/`: Cloudflare Worker エントリ（Hono ルーティング + BFF）
- **外部依存**: `solid-js`, `@langchain/core`, `@langchain/langgraph`, `openai`, `lucide-solid`, `stripe`。

### 1.2 `packages/mcp-server`
- **役割**: OAuth 2.1 Issuer を兼ねた MCP サーバー群（管理・検索・サンプル MCP を提供）。
- **主要責務**:
  - OAuth 認可・トークン発行 (`/auth/*`)
  - MCP REST ラッパー (`/mcp/*`)
  - 管理/検索用の HTTP API (`/mcp/registry/*`, `/mcp/discovery/*`)
- **フレームワーク方針**: `createMcpWorker` でツール/リソース/プロンプトを宣言的に登録できる軽量ラッパーを提供。

### 1.3 `packages/database`
- **役割**: Prisma を用いたデータモデル定義と共有クライアント (`@agent/database`) の提供。
- **主要責務**:
  - Prisma Schema (`prisma/schema.prisma`)
  - TypeScript エクスポート (`src/index.ts`)：`PrismaClient` を再エクスポート
  - Seed / Migration スクリプトのエントリポイント

---

## 2. データモデル仕様（Prisma）

> **備考**: Prisma スキーマに変更を加えた場合、ルートで `npm run db:generate` を必ず実行し、各パッケージの型を更新すること。

### 2.1 モデル: `User`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | ユーザーの一意識別子 |
| `email` | `String` | `@unique` | ログイン用メールアドレス |
| `displayName` | `String?` |  | 表示名（任意） |
| `createdAt` | `DateTime` | `@default(now())` | 作成日時 |
| `updatedAt` | `DateTime` | `@updatedAt` | 最終更新日時 |
| `accounts` | `OAuthAccount[]` |  | OAuth アカウントとの関連 |
| `agentLinks` | `AgentMcpLink[]` |  | ユーザーが追加した MCP との関連 |

### 2.2 モデル: `OAuthAccount`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | アカウントレコード ID |
| `userId` | `String` |  | `User` への外部キー |
| `provider` | `String` |  | OAuth プロバイダ名（例: `google`）|
| `providerAccountId` | `String` |  | プロバイダ側アカウント ID |
| `accessToken` | `String?` |  | アクセストークン（暗号化保存を検討）|
| `refreshToken` | `String?` |  | リフレッシュトークン |
| `expiresAt` | `DateTime?` |  | アクセストークン有効期限 |
| `createdAt` | `DateTime` | `@default(now())` | 作成日時 |
| `updatedAt` | `DateTime` | `@updatedAt` | 最終更新日時 |
| `user` | `User` | `@relation(fields: [userId], references: [id])` | 親ユーザー |
| `@@unique([provider, providerAccountId])` | - | 複合ユニーク制約 | 同一プロバイダ内の重複防止 |

### 2.3 モデル: `McpServer`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id` | `register_server` が生成するサーバー ID。`id.tool` 形式の前半部分となる |
| `name` | `String` |  | 表示名 |
| `url` | `String` | `@unique` | MCP エンドポイント URL（description との整合を保つこと）|
| `description` | `String?` |  | 公開説明文。URL・機能概要を含めること |
| `ownerUserId` | `String?` |  | サーバー所有ユーザー（オプション）|
| `status` | `McpStatus` | `@default(ACTIVE)` | 稼働状態 |
| `authType` | `McpAuthType` | `@default(NONE)` | 認証方式 |
| `createdAt` | `DateTime` | `@default(now())` | 作成日時 |
| `updatedAt` | `DateTime` | `@updatedAt` | 最終更新日時 |
| `tags` | `McpServerTag[]` |  | タグ一覧 |

### 2.4 モデル: `McpServerTag`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | タグレコード ID |
| `mcpServerId` | `String` |  | 紐づく MCP サーバー |
| `tag` | `String` |  | 検索用タグ |
| `server` | `McpServer` | `@relation(fields: [mcpServerId], references: [id])` | 親 MCP サーバー |
| `@@index([tag])` | - | インデックス | タグ検索高速化 |

### 2.5 モデル: `AgentMcpLink`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | リンク ID |
| `userId` | `String` |  | エージェント所有ユーザー |
| `mcpServerId` | `String` |  | MCP サーバー ID |
| `enabled` | `Boolean` | `@default(true)` | 利用可否フラグ |
| `configJson` | `Json?` |  | クライアント固有設定（API キー等）|
| `createdAt` | `DateTime` | `@default(now())` | 作成日時 |
| `updatedAt` | `DateTime` | `@updatedAt` | 最終更新日時 |
| `user` | `User` | `@relation(fields: [userId], references: [id])` | 所有ユーザー |
| `server` | `McpServer` | `@relation(fields: [mcpServerId], references: [id])` | 紐づく MCP サーバー |
| `@@unique([userId, mcpServerId])` | - | 複合ユニーク | 同一 MCP の重複登録防止 |

### 2.6 モデル: `AgentSession`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | セッション ID |
| `userId` | `String` |  | 所有ユーザー |
| `graphState` | `Json` |  | LangGraph 状態スナップショット |
| `checkpoint` | `Json?` |  | チェックポイントデータ |
| `createdAt` | `DateTime` | `@default(now())` | 作成日時 |
| `updatedAt` | `DateTime` | `@updatedAt` | 最終更新日時 |
| `user` | `User` | `@relation(fields: [userId], references: [id])` | 所有ユーザー |
| `messages` | `ConversationMessage[]` | - | 会話ログ |

### 2.7 モデル: `ConversationMessage`
| フィールド | 型 | 属性 | 説明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | メッセージ ID |
| `sessionId` | `String` |  | 所属セッション |
| `role` | `String` |  | `user` / `assistant` / `system` / `tool` |
| `content` | `String` | `@db.Text` | メッセージ本文 |
| `metadata` | `Json?` |  | ツール呼び出し結果や引用情報 |
| `createdAt` | `DateTime` | `@default(now())` | 送信日時 |
| `session` | `AgentSession` | `@relation(fields: [sessionId], references: [id])` | 親セッション |
| `@@index([sessionId])` | - | インデックス | セッション単位の高速取得 |

### 2.8 列挙型
- `enum McpStatus { ACTIVE INACTIVE DEGRADED }`
- `enum McpAuthType { NONE API_KEY OAUTH }`

---

## 3. API 仕様

### 3.1 Cloudflare Worker (`packages/mcp-server/worker/index.ts`)

| メソッド & パス | 用途 | リクエスト | レスポンス | 認証 |
| --- | --- | --- | --- | --- |
| `GET /auth/authorize` | OAuth 認可エンドポイント | `client_id`, `redirect_uri`, `scope`, `code_challenge`, `state` | 302 リダイレクト（認可コード付与） | パブリック |
| `POST /auth/token` | アクセストークン発行 | `grant_type`, `code`, `code_verifier`, `redirect_uri` | `access_token`, `refresh_token?`, `expires_in`, `id_token?` | HTTP Basic or PKCE |
| `GET /.well-known/openid-configuration` | Issuer メタデータ | - | OAuth/OIDC メタ | パブリック |
| `GET /mcp/registry/list` | 登録済み MCP 一覧 | クエリ: `tag?`, `status?`, `owner?`, `cursor?`, `limit?` | `{ items: McpServer[], nextCursor? }` | Bearer (クライアントクレデンシャル) |
| `POST /mcp/registry/register` | MCP サーバー登録 | JSON: `name`, `url`, `tags`, `authType`, `description?` | `{ id: string }` | Bearer (管理スコープ) |
| `POST /mcp/registry/update` | MCP サーバー更新 | JSON: `id`, 更新フィールド | `{ ok: true }` | Bearer (管理スコープ) |
| `POST /mcp/registry/disable` | MCP 無効化 | JSON: `id`, `reason?` | `{ ok: true }` | Bearer |
| `GET /mcp/registry/health/:id` | ヘルスチェック | パス: `id` | `{ status: McpStatus, latencyMs?, checkedAt }` | Bearer |
| `GET /mcp/discovery/search` | 検索MCP HTTP API | クエリ: `q?`, `tags?`, `limit?`, `cursor?` | `{ items: McpServer[], nextCursor? }` | Bearer / API Key |
| `POST /mcp/discovery/suggest` | レコメンド | JSON: `userContext` | `{ items: McpServer[] }` | Bearer |
| `POST /mcp/tools/:id/:toolName` | MCP ツール実行 HTTP 経由 | JSON: `args`, `sessionId?` | ツールの戻り値を JSON 化 | Bearer |

### 3.2 Cloudflare Worker (`packages/agent/worker/index.ts`)

| メソッド & パス | 用途 | リクエスト | レスポンス | 認証 |
| --- | --- | --- | --- | --- |
| `GET /api/user/me` | 現在のユーザー取得 | Cookie / Bearer | `{ user: User }` | 必須 |
| `GET /api/mcp/linked` | ユーザーに紐づく MCP 一覧 | クエリ: `includeDisabled?` | `{ items: AgentMcpLink[] }` | 必須 |
| `POST /api/mcp/search` | 検索MCP 呼び出し代理 | JSON: `query`, `tags?`, `limit?` | `{ items: McpServer[], source: 'discovery' }` | 必須 |
| `POST /api/mcp/link` | MCP 追加 | JSON: `mcpServerId`, `config?` | `{ linkId: string }` | 必須 |
| `POST /api/mcp/unlink` | MCP 無効化 | JSON: `linkId`, `hardDelete?` | `{ ok: true }` | 必須 |
| `POST /api/mcp/test` | 接続テスト | JSON: `mcpServerId`, `tool?`, `args?` | `{ ok: boolean, latencyMs?, error? }` | 必須 |
| `POST /api/agent/chat` | LangGraph 実行開始 | JSON: `sessionId?`, `messages`, `input`, `stream?` | SSE / JSON | 必須 |
| `GET /api/agent/state/:sessionId` | セッション状態取得 | パス: `sessionId` | `{ session, messages, graphState }` | 必須 |
| `POST /api/agent/interrupt` | 実行中断 | JSON: `sessionId`, `reason?` | `{ ok: true }` | 必須 |

---

## 4. OAuth 2.1 & セキュリティ要件

1. **PKCE 必須**: パブリッククライアント（Agent フロントエンド）は `S256` チャレンジを使用。
2. **スコープ設計**:
   - `mcp.registry.read`, `mcp.registry.write`（管理 API）
   - `mcp.discovery.read`（検索）
   - `agent.session.manage`（Agent 側 API）
3. **トークン署名**: `JWT_SECRET` を用いた `HS256`。必要に応じて `exp`, `iat`, `scope` を含める。
4. **ストレージ**: リフレッシュトークンや機微情報は Workers KV/R2 ではなく Durable Object または外部 DB に保存。
5. **CORS**: 開発では `*` を許可。本番では `ALLOWED_ORIGINS` によるホワイトリスト。
6. **レート制限**: 将来的に `mcp-server` Worker で IP ベース/トークンベースのレート制限ミドルウェアを追加。

---

## 5. MCP ラッパー仕様（v0）

### 5.1 API 形状
```ts
import { createMcpWorker, defineTool, defineResource } from '@agent/mcp-server/framework';

const tools = [
  defineTool({
    name: 'echo',
    description: 'Echo back the provided message.',
    schema: z.object({ message: z.string() }),
    handler: async ({ message }, ctx) => ({ message }),
  }),
];

export default createMcpWorker({
  route: '/mcp',
  tools,
  resources: [
    defineResource({
      name: 'server_health',
      loader: async (ctx) => ({ status: 'ok', checkedAt: Date.now() }),
    }),
  ],
  metadata: {
    version: '0.1.0',
    title: 'Agent MCP Example',
  },
});
```

### 5.2 コンテキスト (`ctx`) に含める情報
- `env`: Cloudflare Workers の環境バインディング（Secrets, KV 等）
- `prisma`: `PrismaClient` インスタンス（Lazy 初期化）
- `auth`: 呼び出し元の認証情報 `{ userId?, scopes }`
- `requestId`: ログ相関 ID
- `logger`: 標準化されたロガー（利用予定）

### 5.3 ツールレスポンス規約
- すべてのレスポンスは JSON シリアライズ可能であること。
- エラーは `throw new McpToolError(code, message, { details })` で表現し、HTTP では 4xx/5xx にマッピング。
- 長時間処理は将来的に非同期ジョブ（Durable Object など）へ委譲。

---

## 6. LangGraph ベースエージェント仕様

### 6.1 ノード構成（初期案）
1. `InputNode`: ユーザー入力を受け取りコンテキスト整形。
2. `PlanningNode`: LLM を用いてタスクプラン生成（必要ツール定義）。
3. `ToolExecutionNode`: 必要な MCP ツールを逐次実行。
4. `ResultSynthesisNode`: ツール結果と履歴を統合して回答生成。
5. `FeedbackNode`（任意）: 追加指示を待つ or 中断処理。

### 6.2 内蔵ツール
| ツール名 | 概要 | 入力 | 出力 | 依存 |
| --- | --- | --- | --- | --- |
| `search_mcp_servers` | 検索MCP API を呼び、候補 MCP を返す | `{ query, tags?, limit? }` | `{ items: McpServer[] }` | `/api/mcp/search` |
| `add_mcp_server` | MCP を Agent に追加 | `{ mcpServerId, config? }` | `{ linkId }` | `/api/mcp/link` |
| `list_my_mcp_servers` | リンク済み MCP 一覧を取得 | `{ includeDisabled? }` | `{ items: AgentMcpLink[] }` | `/api/mcp/linked` |
| `remove_mcp_server` | MCP を無効化/削除 | `{ linkId, hardDelete? }` | `{ ok: true }` | `/api/mcp/unlink` |

### 6.3 チェックポイント戦略
- `AgentSession.graphState` に LangGraph ノードの直列化状態（JSON）を保存。
- `ConversationMessage` に各ターンの履歴とツール出力を保存。
- セッション再開時、Graph を復元し、未完了ノードを再実行する。

### 6.4 エッジケース考慮
- セッションタイムアウト（`updatedAt` が閾値を超えた場合、再認証を要求）
- MCP ツール失敗時のバックオフと代替プラン生成
- OAuth トークン失効時の自動リフレッシュ（`OAuthAccount` を参照）

---

## 7. テスト戦略詳細

### 7.1 単体テスト
- MCP ラッパー: ツール登録、スキーマ検証（zod モック）
- LangGraph ノード: 入力/出力検証、条件分岐
- Prisma リポジトリ: 各モデルの CRUD 操作

### 7.2 統合テスト
- Hono ルート: 認証ミドルウェア、CORS 設定
- OAuth フロー: 認可コード取得からトークン発行までのシミュレーション
- Agent API: `/api/agent/chat` 経由でモック MCP を呼び出すフロー

### 7.3 E2E テスト
- Playwright などを使用してチャット UI → MCP 追加 → ツール実行の一連の流れを自動化
- 失敗シナリオ: 不正 MCP URL、ヘルスチェック失敗、トークン期限切れ

---

## 8. 運用・監視項目
- **ロギング**: `requestId`, `userId`, `toolName`, `latencyMs`, `errorCode` を共通フォーマットで出力。
- **メトリクス**: Cloudflare Analytics + 外部 APM（New Relic 等）を想定。
- **アラート**: 主要ツール失敗率 > 5%、OAuth トークン発行失敗率 > 1% を閾値に通知。
- **デプロイ**: `wrangler deploy` を用いた環境毎デプロイ。Secrets は `wrangler secret put` で管理。

---

## 9. 未決事項と今後の検討
- MCP プロトコルの転送形式（SSE/WebSocket）標準化
- フェデレーション対応（複数 Issuer の協調）
- マルチテナント機能（組織単位の権限管理）
- ランキングアルゴリズム（人気度の算出指標）

---

## 10. 付録
- **開発コマンド**:
  - `npm install`
  - `npm run dev:agent`
  - `npm run dev:mcp`
  - `npm run db:generate`
- **環境変数（開発時）**:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `MCP_ISSUER`
  - `ALLOWED_ORIGINS`
  - `MCP_GOOGLE_*`（必要に応じて）

本仕様書は MVP 完了まで継続的に更新される前提であり、各機能の実装フェーズで追加の詳細（エラーハンドリング、スキーマバリデーションなど）を追記すること。
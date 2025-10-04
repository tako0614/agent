## AI Agent Monorepo 開発計画（PLAN）

本ドキュメントは、Cloudflare Workers 上で動作する MCP（Model Context Protocol）サーバー群と、独立したフロントエンド/Agent サービスを OAuth で連携させるプロダクトの高レベル計画を示す。

> 詳細仕様（データモデル、API 仕様、LangGraph フローなど）は `docs/specs/DETAILED_SPEC.md` に分離した。実装時はそちらを参照すること。

## ビジョン / ゴール

- JavaScript（TypeScript）で「Cloudflare Workers っぽい DX」で MCP サーバーを簡単に作れるラッパー（軽量フレームワーク）を提供する。
- そのラッパーを使って、まずは 2 種の MCP サーバーを提供する：
	- 管理MCP（Registry/Orchestrator）：デプロイ済み MCP サーバーを登録・監視・配布
	- 検索MCP（Discovery/Search）：タグや機能で MCP サーバーを検索
- Agent は上記 MCP サーバー（管理/検索）に接続し、見つけた MCP サーバーを自動で追加できる。
- Agent と MCP サーバーは完全に独立したサービスで、OAuth 2.1 により連携する。

成功基準（MVP）
- Cloudflare Workers 上で動作する MCP サーバーを、ラッパー APIで 50 行未満の実装例で立ち上げられる。
- 管理MCPが、登録済み MCP サーバーの一覧取得・登録・ヘルスチェックを提供する。
- 検索MCPが、タグ/キーワード検索で MCP サーバー候補を返す。
- Agent UI から OAuth でログインし、検索→選択→自身の Agent に MCP を自動追加できる。

---

## 全体アーキテクチャ概要

- Monorepo（npm workspaces）
	- packages/agent：SolidJS + Vite（フロントエンド）/ Cloudflare Workers（BFF/API, Hono）
	- packages/database：Prisma クライアント共有
	- packages/mcp-server：Workers 上の OAuth 2.1 + MCP 実装、および MCP ラッパー

ランタイム/ポート（開発時）
- Vite dev（frontend）：http://localhost:3000
- Workers dev（agent）：http://localhost:8787
- Workers dev（mcp-server）：http://localhost:8788

プロキシ/ルーティング
- `packages/agent/vite.config.ts` が `/api` を 8787 にプロキシ
- `run_worker_first = ["/api/*", "/mcp/*", "/auth/*"]`（Workers 優先）

---

## 提供コンポーネントと役割

1) MCP Server ラッパー（Workers 向け）
- 目的：Workers で MCP ツール/リソース/プロンプトを簡単に定義し、HTTP 経由で MCP を話せるサーバーを最小コードで作れるようにする。
- 形態：`packages/mcp-server` にフレームワーク（例：`src/framework/*`）。同パッケージの Worker 実装からも利用。
- 開発者体験（DX）例：
	- `createMcpWorker({ tools, resources, metadata })` を呼ぶと Hono ルーターを返す
	- `app.route('/mcp', mcpRouter)` で公開
	- MCP ハンドラは `async function toolName(args, ctx)` のように記述

2) 管理MCP（Registry/Orchestrator）
- 役割：
	- MCP サーバーの登録/更新/無効化
	- ヘルスチェック（/health かプロトコルで ping）
	- 配布（クライアントに接続情報やメタデータ提供）
- 主要ツール（想定）：
	- `list_servers`（フィルタ: tag, status, owner）
	- `register_server`（AI がユニークな serverId を割り振り、description にエンドポイント URL を含める。tags/auth を登録。Agent はこの serverId を使って `id.tool` 形式のツール識別子を生成する）
	- `update_server` / `disable_server`
	- `get_server_info` / `health_check`

3) 検索MCP（Discovery/Search）
- 役割：
	- タグ/キーワードで MCP サーバーを検索
	- レコメンド（人気/最近追加/高評価）
- 主要ツール（想定）：
	- `search_servers`（q, tags, limit, cursor）
	- `suggest_servers`（user_context）

4) Agent（フロント/Worker）
- 役割：
  - OAuth で mcp-server と連携
  - **ツール経由で MCP 検索・追加**を実行（エージェント自身が必要なツールを発見・追加）
  - 追加済み MCP の一覧/有効化/無効化/設定
  - **LangGraph による状態管理とエージェント実行**（会話/タスク/ツール呼び出し）
- Agent アーキテクチャ（LangGraph）：
  - **StateGraph** で会話フローを管理（ユーザー入力 → プラン → ツール実行 → 応答）
  - **ノード**：LLM 呼び出し、MCP ツール実行、条件分岐、検索/保存ロジック
  - **エッジ/条件分岐**：ツール結果に応じた次アクション決定
  - **チェックポイント**：会話履歴やエージェント状態を永続化（KV/DB）
  - **MCP ツールを LangChain Tool としてラップ**し、LangGraph ノードから呼び出し
	- LangGraph 内部でのツール識別子は `id.tool`（例：`registry-123.list_servers`）形式に統一し、`register_server` が発行するユニーク ID と MCP 提供ツール名を連結して名前衝突を防ぐ
  - **内蔵ツール**（Agent 自身の機能）：
    - `search_mcp_servers`：検索MCP を呼び出してツール候補を取得
    - `add_mcp_server`：検索結果から MCP を自分に追加（`AgentMcpLink` 作成）
    - `list_my_mcp_servers`：現在追加済みの MCP 一覧
    - `remove_mcp_server`：MCP の削除/無効化
- UI 要素（MVP）：
  - チャット UI（会話履歴、ストリーミング応答）
  - エージェント実行状態の可視化（プラン/ツール呼び出し/完了）
  - **（オプション）MCP 管理 GUI**：検索/追加/削除を手動操作できる UI（ツールと同じ API を使用）
  - 「接続テスト」＆ステータスアイコン---

## データモデル（概要）

- Prisma により `User`、`OAuthAccount`、`McpServer`、`AgentMcpLink`、`AgentSession`、`ConversationMessage` 等を定義し、MCP レジストリとエージェントセッションを永続化する。
- 列挙型 `McpStatus` と `McpAuthType` によりサーバーステータスと認証方式を管理する。
- フィールド詳細やリレーション要件は `docs/specs/DETAILED_SPEC.md` を参照。

---

## API 設計（概要）

- `packages/mcp-server` の Worker は OAuth 発行 (`/auth/*`)、MCP レジストリ (`/mcp/registry/*`)、検索 (`/mcp/discovery/*`)、および MCP プロトコル実行 API を担当する。
- `packages/agent` の Worker はユーザー情報、MCP 管理、LangGraph 実行を提供する `/api/*` エンドポイントを持つ。
- エンドポイントごとのパラメータ・レスポンス仕様は `docs/specs/DETAILED_SPEC.md` に記載。

---

## OAuth 2.1 連携（高レベルフロー）

前提：`packages/mcp-server` が Issuer。Agent はクライアントとして登録。

1. Agent のユーザーが「MCP を追加」→ 検索MCPを呼び候補を取得
2. 追加時に、必要なら mcp-server 側の OAuth 認可画面へ（PKCE を推奨）
3. トークン取得後、Agent は `AgentMcpLink` を作成し、接続情報/スコープを保存
4. Agent から対象 MCP に対し、MCP プロトコルでツール呼び出しが可能に

Secrets（dev は `.dev.vars`）：
- `MCP_ISSUER`, `JWT_SECRET`
- `MCP_GOOGLE_CLIENT_ID`, `MCP_GOOGLE_CLIENT_SECRET`, `MCP_GOOGLE_REDIRECT_URI`（任意） `ALLOWED_ORIGINS`
- `ALLOWED_ORIGINS`

---

## Workers 向け MCP ラッパーの方針

- エクスポート（案）：
	- `createMcpWorker(config)`：Hono ルーターを返す
	- `defineTool({ name, description, schema, handler })`
	- `defineResource({ name, loader })`
	- `withAuth(handler, { requiredScopes })`
- 非目標（MVP）：複雑なトランスポート抽象化や他プラットフォーム拡張
- 目標：Workers の KV/DO/R2 を使ったセッションやキャッシュを容易に活用できる DX

---

## 開発マイルストーン（MVP → 拡張）

### 進捗サマリ（2025-10-04）

- Prisma スキーマとクライアント生成を完了し、`User` ~ `ConversationMessage` までのデータモデルを確定。
- MCP Registry HTTP API（list/register/update/disable/health）を Cloudflare Worker 上に実装、スコープ検証と Zod バリデーションを導入。
- ワーカー共通基盤として CORS 設定、Request ID、Prisma 初期化、JWT ベースのスコープ検証を整備。

M0: 基盤整備
- [x] `@agent/database` の Prisma 初期スキーマ追加 → `npm run db:generate`
- [ ] `packages/mcp-server` に Issuer 骨組み（Arctic+jose+Hono）
- [ ] CORS/ルーティング/Secrets の開発環境セット

M1: MCP ラッパー v0
- [ ] `src/framework` に最小の `createMcpWorker` 実装
- [ ] ツール1個のサンプル（echo など）と e2e 呼び出し

M2: 管理MCP（Registry）
- [x] `McpServer` 登録/更新 API（HTTP）
- [ ] MCP ツール `list_servers`/`register_server`
- [ ] ヘルスチェック cron or on-demand

M3: 検索MCP（Discovery）
- [ ] インデックス（タグ/テキスト）
- [ ] MCP ツール `search_servers`/`suggest_servers`

M4: Agent 連携
- [ ] OAuth ログイン（mcp-server Issuer）
- [ ] **LangGraph によるエージェント実装**
  - [ ] StateGraph 定義（会話フロー、ツール呼び出しノード）
  - [ ] MCP ツールの LangChain Tool ラッパー（動的読み込み）
  - [ ] **内蔵ツール実装**（`search_mcp_servers`, `add_mcp_server`, `list_my_mcp_servers`, `remove_mcp_server`）
  - [ ] チェックポイント/セッション管理（`AgentSession` 永続化）
  - [ ] ストリーミング応答（SSE または WebSocket）
- [ ] チャット UI（会話履歴、エージェント状態表示）
- [ ] **（オプション）MCP 管理 GUI**（検索/追加 UI：ツールと同じ API を使用）
- [ ] 接続テスト/インジケータ

M5: ハードニング/運用
- [ ] 認可スコープ/レート制限
- [ ] 監査ログ/メトリクス
- [ ] 本番 CORS/Secrets/アラート

---

## テスト計画（抜粋）

- ユニット：ラッパーのツール登録/呼び出し、スキーマバリデーション
- コンポーネント：Hono ルートの認証ガード、DB リポジトリ
- **LangGraph エージェント**：
  - グラフ実行（モックツール、状態遷移）
  - チェックポイント保存/復元
  - MCP ツールの動的ロード/実行
  - **内蔵ツール**（`search_mcp_servers`, `add_mcp_server`）の実行
  - エラーハンドリング（ツール失敗、LLM タイムアウト）
- e2e（dev）：
  - 起動（8787, 8788）→ 管理MCPに登録
  - **チャットで「天気ツールを追加して」→ エージェントが検索MCP呼び出し → 候補から自動追加 → 天気ツール使用**
  - チャット開始 → MCP ツール呼び出し → 応答確認
  - 失敗系：不正 URL、失敗するヘルス、トークン期限切れ、ツールエラー---

## リスク/未決事項

- MCP プロトコルの詳細互換範囲（HTTP 経由の具象化方式）
- 検索のランキング/スパム対策
- 複数 Issuer（将来のフェデレーション対応）
- マルチテナント（組織/ワークスペース）設計のスコープ

---

## 次の一手（開発者 ToDo）
1. Prisma スキーマに対する初回マイグレーション作成と `npm run db:push` の実行
  - 本番/開発双方での `DATABASE_URL` 管理方針を整理
2. mcp-server 側に OAuth Issuer 雛形と `/auth` 実装を追加（PKCE 対応まで）
3. Registry API に対する統合テスト（認証スコープ検証・エラーパス）を整備
4. ラッパー v0（echo ツール）を作り、Workers で動くことを手元検証
5. **Agent 側 LangGraph 実装**（`packages/agent/worker/graph.ts` など）
  - StateGraph 定義（基本的な会話フロー）
  - **内蔵ツール実装**（`search_mcp_servers`, `add_mcp_server` など）
  - MCP ツールのラッパー作成（動的読み込み）
  - チェックポイント機能の統合
6. チャット UI プロトタイプ（会話履歴、エージェント実行状態の可視化）
7. **（オプション）MCP 管理 GUI**（検索/追加 UI：内蔵ツールと同じ API を使用）

---

参考：既存の構成/規約
- `packages/agent/worker/index.ts`：Hono アプリのエントリ
- `packages/mcp-server/worker/index.ts`：MCP + OAuth のエントリ
- `packages/database`：`@agent/database` として PrismaClient を共有
- 開発コマンド（ルート）
	- `npm run dev:agent`（Vite ビルド→Wrangler dev）
	- `npm run dev:mcp`（MCP サーバー dev：port 8788）
	- `npm run db:generate`（Prisma Client 生成）


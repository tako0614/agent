## AI Agent Monorepo 開発計画（PLAN）

本ドキュメントは、Cloudflare Workers 上で動作する MCP（Model Context Protocol）サーバー群と、独立したフロントエンド/Agent サービスを OAuth で連携させるプロダクトの計画書です。

---

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
	- `register_server`（url, name, tags, auth）
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
	- 検索MCPを叩いて候補を取得→ユーザー選択/ポリシーに応じて自動追加
	- 追加済み MCP の一覧/有効化/無効化/設定
- UI 要素（MVP）：
	- 「MCP を探す」モーダル（検索/タグ/プレビュー）
	- 「追加」ボタンで自動配線（接続情報保存）
	- 「接続テスト」＆ステータスアイコン

---

## データモデル（Prisma 下書き）

場所：`packages/database/prisma/schema.prisma`

目的：ユーザー、OAuth、MCP サーバーのレジストリ、Agent と MCP のリンクを保持。

候補スキーマ（抜粋・ドラフト）

```prisma
model User {
	id           String   @id @default(cuid())
	email        String   @unique
	displayName  String?
	createdAt    DateTime @default(now())
	updatedAt    DateTime @updatedAt
	accounts     OAuthAccount[]
	agentLinks   AgentMcpLink[]
}

model OAuthAccount {
	id                String   @id @default(cuid())
	userId            String
	provider          String
	providerAccountId String
	accessToken       String?
	refreshToken      String?
	expiresAt         DateTime?
	createdAt         DateTime @default(now())
	updatedAt         DateTime @updatedAt
	user              User     @relation(fields: [userId], references: [id])
	@@unique([provider, providerAccountId])
}

model McpServer {
	id          String   @id @default(cuid())
	name        String
	url         String   @unique // MCP エンドポイント（Workers）
	description String?
	ownerUserId String?
	status      McpStatus @default(ACTIVE)
	authType    McpAuthType @default(NONE)
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	tags        McpServerTag[]
}

model McpServerTag {
	id          String   @id @default(cuid())
	mcpServerId String
	tag         String
	server      McpServer @relation(fields: [mcpServerId], references: [id])
	@@index([tag])
}

model AgentMcpLink {
	id          String   @id @default(cuid())
	userId      String
	mcpServerId String
	enabled     Boolean  @default(true)
	configJson  Json?
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	user        User      @relation(fields: [userId], references: [id])
	server      McpServer @relation(fields: [mcpServerId], references: [id])
	@@unique([userId, mcpServerId])
}

enum McpStatus { ACTIVE INACTIVE DEGRADED }
enum McpAuthType { NONE API_KEY OAUTH }
```

備考：本番運用で必要になれば、評価/人気度、ヘルス履歴、監査ログ、組織テナントなどを追加。

---

## API 設計（Hono on Workers, 概要）

共通：CORS は dev で `*`、本番はオリジン制限。`/auth/*` は OAuth、`/mcp/*` は MCP 関連。

packages/mcp-server/worker/index.ts（例）
- `GET /auth/authorize`（OAuth 2.1 認可）
- `POST /auth/token`（トークン発行）
- `GET /.well-known/openid-configuration`（Issuer メタ）
- `GET /mcp/registry/list`（管理MCP公開: HTTP JSON でも提供）
- `POST /mcp/registry/register`
- `GET /mcp/registry/health/:id`
- `GET /mcp/discovery/search`
- MCP プロトコルエンドポイント（例 `/mcp/*` に集約、ラッパーがハンドリング）

packages/agent/worker/index.ts（例）
- `GET /api/user/me`
- `GET /api/mcp/linked`（自分の Agent に紐づく MCP リスト）
- `POST /api/mcp/link`（検索結果から追加）
- `POST /api/mcp/unlink`
- `POST /api/mcp/test`（接続テスト）

---

## OAuth 2.1 連携（高レベルフロー）

前提：`packages/mcp-server` が Issuer。Agent はクライアントとして登録。

1. Agent のユーザーが「MCP を追加」→ 検索MCPを呼び候補を取得
2. 追加時に、必要なら mcp-server 側の OAuth 認可画面へ（PKCE を推奨）
3. トークン取得後、Agent は `AgentMcpLink` を作成し、接続情報/スコープを保存
4. Agent から対象 MCP に対し、MCP プロトコルでツール呼び出しが可能に

Secrets（dev は `.dev.vars`）：
- `MCP_ISSUER`, `JWT_SECRET`
- `MCP_GOOGLE_CLIENT_ID`, `MCP_GOOGLE_CLIENT_SECRET`, `MCP_GOOGLE_REDIRECT_URI`（任意）
- `DATABASE_URL`, `ALLOWED_ORIGINS`

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

M0: 基盤整備
- [ ] `@agent/database` の Prisma 初期スキーマ追加 → `npm run db:generate`
- [ ] `packages/mcp-server` に Issuer 骨組み（Arctic+jose+Hono）
- [ ] CORS/ルーティング/Secrets の開発環境セット

M1: MCP ラッパー v0
- [ ] `src/framework` に最小の `createMcpWorker` 実装
- [ ] ツール1個のサンプル（echo など）と e2e 呼び出し

M2: 管理MCP（Registry）
- [ ] `McpServer` 登録/更新 API（HTTP）
- [ ] MCP ツール `list_servers`/`register_server`
- [ ] ヘルスチェック cron or on-demand

M3: 検索MCP（Discovery）
- [ ] インデックス（タグ/テキスト）
- [ ] MCP ツール `search_servers`/`suggest_servers`

M4: Agent 連携
- [ ] OAuth ログイン（mcp-server Issuer）
- [ ] 検索 UI → 選択 → `AgentMcpLink` 作成
- [ ] 接続テスト/インジケータ

M5: ハードニング/運用
- [ ] 認可スコープ/レート制限
- [ ] 監査ログ/メトリクス
- [ ] 本番 CORS/Secrets/アラート

---

## テスト計画（抜粋）

- ユニット：ラッパーのツール登録/呼び出し、スキーマバリデーション
- コンポーネント：Hono ルートの認証ガード、DB リポジトリ
- e2e（dev）：
	- 起動（8787, 8788）→ 管理MCPに登録 → 検索 → Agent で追加
	- 失敗系：不正 URL、失敗するヘルス、トークン期限切れ

---

## リスク/未決事項

- MCP プロトコルの詳細互換範囲（HTTP 経由の具象化方式）
- 検索のランキング/スパム対策
- 複数 Issuer（将来のフェデレーション対応）
- マルチテナント（組織/ワークスペース）設計のスコープ

---

## 次の一手（開発者 ToDo）

1. Prisma 下書きの確定とマイグレーション作成（`packages/database/prisma/schema.prisma`）
2. mcp-server 側に Issuer の雛形と `/mcp` ルーターの足場を作成
3. ラッパー v0（echo ツール）を作り、Workers で動くことを手元検証
4. Agent UI に「MCP を探す」モーダルのワイヤーを配置（ダミー API で開始）

---

参考：既存の構成/規約
- `packages/agent/worker/index.ts`：Hono アプリのエントリ
- `packages/mcp-server/worker/index.ts`：MCP + OAuth のエントリ
- `packages/database`：`@agent/database` として PrismaClient を共有
- 開発コマンド（ルート）
	- `npm run dev:agent`（Vite ビルド→Wrangler dev）
	- `npm run dev:mcp`（MCP サーバー dev：port 8788）
	- `npm run db:generate`（Prisma Client 生成）


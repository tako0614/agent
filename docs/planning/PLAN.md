# プロジェクト計画 (PLAN)

本ドキュメントは、本モノレポにおける「MCP サーバー群」と「Agent アプリ」の中長期計画をまとめたものです。要求は以下のとおり:

- mcp-server: JavaScript で Workers 風に MCP サーバーを簡単に構築できる「Workers ラッパ」を提供する。さらに「メタ MCP サーバー」を実装する。これは、デプロイ済みの MCP サーバーを管理する MCP サーバー、および MCP サーバーを検索する MCP サーバーを提供する。
- agent: Agent は MCP サーバー検索を用いてサーバーを自動追加し、各 MCP と連携して様々な操作を行えるようにする。agent と mcp-server は完全に独立したサービスで、OAuth (2.1) によって連携する。

## 1. ゴールと非ゴール

### ゴール
- Workers 風の DX で MCP サーバーを素早く構築・デプロイできる。
- メタ MCP サーバーが「MCP サーバーの登録・可視化・検索・健全性確認・OAuth 連携情報の配布」を提供。
- Agent はメタ MCP サーバーの検索結果から OAuth フローを踏んで安全に接続し、ツール一覧を同期・自動追加できる。
- 仕様に沿った OAuth 2.1 + PKCE をベースとしたセキュアな連携。

### 非ゴール
- 独自の認証方式の発明 (標準 OAuth を最優先)。
- ベンダー固有クラウドに強くロックインする設計 (Cloudflare Workers 優先だが抽象化を保持)。

## 2. 全体アーキテクチャ

```
┌─────────────────────┐       OAuth 2.1       ┌─────────────────────┐
│        Agent         │◀────────────────────▶│      MCP Server      │
│ (SolidJS + Worker)   │                      │  (Workers + Hono)    │
└──────────┬──────────┘                      └──────────┬──────────┘
					 │  検索/登録 API                                   │
					 ▼                                                  ▼
	 ┌─────────────────────┐                          ┌─────────────────────┐
	 │ Meta MCP Server     │───管理/検索/健全性───▶  │ Deployed MCP Servers │
	 │ (Registry/Search)   │◀──登録/メタ情報取得───  │  (複数インスタンス)   │
	 └─────────────────────┘                          └─────────────────────┘
```

- Meta MCP Server: MCP サーバーのレジストリ兼検索 API。OAuth メタデータや MCP ツール概要、稼働状況を集約。
- Deployed MCP Servers: 業務ごとのツールを実装した MCP サーバーたち (Booking/Product/Order/Form など)。
- Agent: Meta MCP Server を参照し、ユーザーの同意を得て OAuth 連携、ツールの自動追加・同期、実行 UI 提供。

## 3. コンポーネント詳細

### 3.1 MCP Workers ラッパ (JavaScript)
- 目的: Cloudflare Workers と同様の DX で MCP サーバーを作成可能にする。
- 形態: `@mcp/worker` 的な薄いフレームワーク層。Hono に中間層を挟み、
	- ルーティング: `app.mcpTool('name', schema, handler)` のような宣言 API
	- 認証: Bearer/JWT + OAuth 2.1 メタデータ提供 (RFC 9728/8414)
	- 型: ツール I/O スキーマの型生成 (zod/valibot 推奨)
	- ロギング/メトリクス: 監視のための hooks 提供
- 成果物: `createMcpWorker()` が `fetch(request, env, ctx)` を返し、Workers へデプロイ可能。

### 3.2 Meta MCP Server (管理 + 検索)
- サービス分割 (同一 Worker 内の論理モジュールでも可):
	1) Registry: MCP サーバーの登録/更新、OAuth メタデータ、スコープ/ツール一覧のキャッシュ。
	2) Discovery/Search: タグ/カテゴリ/スコープ/地域などで検索可能なインデックス。
	3) Health/Status: 稼働確認 (ヘルスチェック、トークン不要でのステータス確認範囲の定義)。
- 公開 API: 後述の API 仕様参照。
- データ: `packages/database` を用いて永続化。

### 3.3 Deployed MCP Servers
- 共通: MCP Workers ラッパを利用し、OAuth 2.1 対応、`/.well-known` エンドポイント提供。
- 業務: booking/product/order/form などのツール群を提供。

### 3.4 Agent アプリ
- 機能:
	- Meta MCP Server から検索→結果を一覧表示→選択すると OAuth 連携フローへ誘導。
	- 連携後、ツール一覧の自動同期とカテゴリ別 UI 生成。
	- 実行履歴、エラー表示、トークン更新、切断管理。
- セキュリティ: OAuth 2.1 + PKCE、refresh token、scope 切り替え UI。

## 4. セキュリティ & OAuth 連携

- RFC 準拠: RFC 9728 (PRM), RFC 8414 (AS Metadata), RFC 8707 (Resource Indicators), RFC 7636 (PKCE), RFC 7591 (Dynamic Client Registration)。
- 基本フロー:
	1) Agent はメタ MCP 経由で対象 MCP の `resource_metadata` を取得。
	2) Authorization Server Metadata を取得し、DCR (必要に応じて) を実行。
	3) Authorization Code + PKCE によりユーザー同意を取得。
	4) Access Token (JWT) + Refresh Token を受領し、安全に保管。
	5) Bearer で MCP Tools API を呼び出し、WWW-Authenticate を適切処理。
- 権限設計: スコープ設計はツール群に合わせて粒度を揃える (例: `booking:read|write`)。

## 5. API 仕様 (ドラフト)

### 5.1 Meta MCP Server

- `GET /.well-known/oauth-authorization-server` / `GET /.well-known/oauth-protected-resource`
	- OAuth メタデータ配布 (Agent からの自動検出を許可)

- `POST /registry/servers`
	- 概要: MCP サーバーの登録 (URL, タグ, カテゴリ, 所有者、公開範囲)
	- 認証: 管理者/オーナー用トークン
	- 成功: `201 Created` + 登録レコード

- `GET /registry/servers/:id`
	- 概要: 登録済み MCP の詳細 (OAuth メタデータ、スコープ、ツールサマリ/キャッシュ)

- `GET /search`
	- クエリ: `q, tag, scope, category, owner, region, limit, cursor`
	- 戻り: 検索結果のリスト + ページング

- `GET /health/:id`
	- 概要: 登録 MCP のヘルス/可用性チェック結果

- `POST /introspect`
	- 概要: 登録 MCP への token 検証 (委任オプション) またはメタ情報整合性確認

### 5.2 MCP Worker (各サーバー)

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource`
- `POST /oauth/register` `GET /oauth/authorize` `POST /oauth/token`
- `GET /mcp` `GET /mcp/tools`
- `GET/POST /mcp/tools/:tool/...` (ツールごとのルート)

## 6. データモデル (概略)

Prisma 例 (概略、実スキーマは `packages/database/prisma/schema.prisma` で管理):

- `McpServer`
	- id, baseUrl, name, description, tags[], categories[], ownerId
	- oauthIssuer, authorizationEndpoint, tokenEndpoint, jwksUri
	- scopes[], toolsSummary (json), visibility, createdAt, updatedAt

- `McpOwner (User/Org)`
	- id, type, name, contact

- `AgentConnection`
	- id, agentUserId, mcpServerId, scopesGranted[], createdAt
	- tokenSet (encrypted), status (active/revoked), lastSyncAt

- `HealthCheck`
	- id, mcpServerId, status, latencyMs, checkedAt, detail

## 7. 開発計画 (マイルストーン)

### M1: 基盤整備 (Workers ラッパ最小版 + Meta MCP 骨格)
- MCP Workers ラッパ: `createMcpWorker()`, `app.mcpTool()` の最小実装
- `/.well-known` と OAuth 2.1 のメタデータ配信 (固定値/設定ベース)
- Meta MCP: `POST /registry/servers`, `GET /search` の最小実装
- Database: `McpServer` スキーマの初版、Prisma generate

### M2: OAuth 連携/実運用準備
- Authorization Code + PKCE + DCR を安定化
- スコープ設計と `WWW-Authenticate` 正常化
- HealthCheck バッチ/エンドポイント実装
- Meta MCP の詳細画面 API (`GET /registry/servers/:id`)

### M3: Agent 連携と自動追加
- Agent UI: 検索→選択→OAuth 同意→接続の一連を実装
- 接続後のツール自動同期と UI 自動生成 (カテゴリ/タグ別)
- 失効/再認可、トークン更新 UI

### M4: 拡張と運用
- 監査ログ、メトリクス、通知 (失効/障害)
- エクスポート/インポート (サーバー登録の JSON)
- 組織/テナント対応、RBAC

## 8. 実装指針と技術選定

- ランタイム: Cloudflare Workers (Hono)。将来的に Miniflare/Node 互換を視野に抽象化
- 型/バリデーション: TypeScript + zod/valibot
- セキュアストレージ: TokenSet は暗号化保管 (Web Crypto / Workers Secrets)
- Observability: 標準ログ + 低コストヘルスプローブ
- テスト: e2e は Vitest + Miniflare。または `wrangler dev` を使った統合試験

## 9. リスクと対策

- OAuth 実装の複雑性: 既存コード (packages/mcp-server) を共通ライブラリ化し重複を削減
- 検索/登録のスパム対策: レート制限、所有者確認、非公開/審査制の導入
- ベンダーロックイン: fetch ハンドラとストレージを薄く抽象化

## 10. 進め方 (次アクション)

1) Workers ラッパの API デザインを小さく決め、`packages/mcp-server` で PoC 実装
2) Meta MCP Server の最小 API (`POST /registry/servers`, `GET /search`) を作成
3) Prisma に `McpServer` モデル追加し `db:generate` 実行
4) Agent 側に「検索→追加→OAuth 同意」のモック UI を追加
5) M2 以降で DCR/PKCE/ヘルスチェックなどを段階的に拡充

---

この計画はドラフトです。実装が進むにつれて API とデータモデルはバージョン管理しながら更新します。


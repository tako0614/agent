<h1 align="center">Agent Monorepo</h1>

## 🧭 Overview

Vite + SolidJS フロントエンド、Cloudflare Workers ベースのバックエンド、Prisma + D1 (SQLite) を用いたデータ層で構成された AI エージェント プロダクトのモノレポです。

- **フロントエンド / エッジ API**: `packages/agent` — SolidJS + Cloudflare Workers (Hono) による UI & BFF
- **データアクセス層**: `packages/database` — Prisma + Cloudflare D1 を用いた共通データベースクライアント
- **MCP サーバー**: `packages/mcp-server` — OAuth 2.1 対応の Model Context Protocol サーバー
- **ドキュメント**: 要件・設計メモは `docs/` 以下に整理

### 🗄️ データベース: Cloudflare D1

このプロジェクトは **Cloudflare D1**（SQLite ベース）を使用しています。

- ✅ Cloudflare Workers とのネイティブ統合
- ✅ グローバルエッジでの低レイテンシー
- ✅ 無料プランあり（5GB、500万読み取り/日）

詳細は [`D1_MIGRATION.md`](./D1_MIGRATION.md) を参照してください。

## 🗂️ Directory Structure

```text
.
├─ package.json               # ルートワークスペース設定 (npm workspaces)
├─ README.md                  # このドキュメント
├─ docs/
│  └─ planning/
│     └─ PLAN.md              # プロジェクト計画と設計ノート
└─ packages/
   ├─ agent/                # フロントエンド + Worker エントリ
   │  ├─ README.md          # Agent アプリのセットアップ/運用ガイド
   │  ├─ index.html         # SolidJS ルート HTML
   │  ├─ src/               # SolidJS フロントエンド実装
   │  ├─ worker/            # Cloudflare Worker (Hono) API
   │  ├─ tsconfig*.json     # TypeScript 設定
   │  └─ wrangler.toml      # Cloudflare Workers 設定
   ├─ database/             # Prisma ベースのデータアクセスレイヤー
   │  ├─ README.md          # セットアップと Prisma ワークフロー
   │  ├─ prisma/schema.prisma # データベーススキーマ
   │  └─ src/               # Prisma クライアントとサービス層
   └─ mcp-server/           # Model Context Protocol サーバー実装
      ├─ README.md          # OAuth 2.1 + MCP の詳細
      ├─ worker/            # Cloudflare Worker エントリ & ルーティング
      ├─ types/             # 型補完 (Cloudflare Workers types など)
      └─ wrangler.toml      # デプロイ設定
```

## 📦 Workspace Packages

| Package | 役割 | 主な技術 | 補足ドキュメント |
|---------|------|----------|------------------|
| `packages/agent` | SolidJS UI と Cloudflare Worker API の統合アプリ | Vite, SolidJS, Hono, Cloudflare Workers | [`packages/agent/README.md`](./packages/agent/README.md) |
| `packages/database` | Prisma を利用した共通データアクセスレイヤー | Prisma, TypeScript | [`packages/database/README.md`](./packages/database/README.md) |
| `packages/mcp-server` | OAuth 2.1 準拠の MCP サーバー | Cloudflare Workers, Hono, OAuth 2.1, JWT | [`packages/mcp-server/README.md`](./packages/mcp-server/README.md) |

## 🔁 Package Dependencies

- `packages/agent` と `packages/mcp-server` は、共通の Prisma クライアントを `@agent/database` パッケージとして利用可能。
- MCP サーバーは OAuth フローやビジネスツール API を提供し、フロントエンドや外部 MCP クライアントが利用する想定。
- すべてのパッケージは TypeScript で実装され、Cloudflare Workers 向けビルドを想定。

## 🛠️ Root Scripts

| コマンド | 説明 |
|----------|------|
| `npm run dev:agent` | フロントエンド & Worker の開発サーバー (`packages/agent`) を起動 |
| `npm run dev:mcp` | MCP Worker のローカル開発サーバー (`packages/mcp-server`) を起動 |
| `npm run build` | 全ワークスペースのビルドを一括実行 |
| `npm run db:generate` | `packages/database` の Prisma クライアントを生成 |

個別パッケージの詳細なスクリプトやセットアップ手順は各 README を参照してください。

## 📑 Documentation

- [`D1_MIGRATION.md`](./D1_MIGRATION.md) — **Cloudflare D1 データベースのセットアップとマイグレーション**
- `docs/planning/PLAN.md` — プロダクトの計画、要件、実装指針
- `packages/*/README*.md` — 各パッケージに固有のセットアップ手順や API 仕様
- OAuth セットアップ: [`packages/mcp-server/SETUP_OAUTH.md`](./packages/mcp-server/SETUP_OAUTH.md)
- OAuth クライアントガイド: [`packages/agent/README_OAUTH2_CLIENT.md`](./packages/agent/README_OAUTH2_CLIENT.md)

## 🚀 Getting Started

```powershell
# 1. 依存関係のインストール
npm install

# 2. D1 データベースの初期化（初回のみ）
cd packages\agent
npx wrangler d1 execute agent-db --local --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --local --file=../database/migrations/0002_add_oauth_state.sql
cd ..\..

# 3. Prisma Client の生成
npm run db:generate

# 4. 環境変数の設定
# packages/agent/.dev.vars を編集（Google OAuth設定など）
# packages/mcp-server/.dev.vars を編集（必要に応じて）

# 5. Agent アプリを開発モードで起動
npm run dev:agent

# 6. 別ターミナルで MCP サーバーを起動（オプション）
npm run dev:mcp
```

詳細なセットアップ手順は [`D1_MIGRATION.md`](./D1_MIGRATION.md) を参照してください。

## 🧭 Next Steps

- Prisma スキーマ変更後は `npm run db:generate` を実行し、関連パッケージの型を更新
- Cloudflare Workers デプロイ時は `wrangler.toml` の環境変数・シークレットを設定
- MCP OAuth 連携を行う場合は [`packages/mcp-server/README_OAUTH.md`](./packages/mcp-server/README_OAUTH.md) のフローに従ってクライアント登録を実施

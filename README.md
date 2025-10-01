# AI Service Builder

AIでネットサービスを誰でも簡単に作れるプラットフォーム

## ✨ 特徴

- 🤖 **AIエージェント**: OpenAI + LangGraphを活用した万能AIエージェント
- 👥 **利用者側機能**: 予約、購入、フォーム送信など、サービスを利用できる
- 🔧 **管理者側機能**: サービス、商品、フォームの作成・管理ができる
- 🎯 **専用ツール**: 予約システム、ECサイト、フォームなど用途別ツール
- 💬 **ChatGPT風UI**: 直感的なチャットインターフェース
- 🔌 **公開REST API**: 外部アプリケーションからも利用可能
- 💳 **Stripe決済**: 安全な決済システム統合
- ☁️ **Cloudflare Workers**: 高速でスケーラブルなエッジコンピューティング

## 🛠️ 技術スタック

### フロントエンド
- **Vite 7.x** - 高速ビルドツール
- **SolidJS 1.8** - リアクティブUIフレームワーク
- **TailwindCSS 4.x** - モダンなスタイリング
- **Solid Markdown** - マークダウンレンダリング

### バックエンド
- **Cloudflare Workers** - サーバーレスプラットフォーム
- **Hono 4.x** - 軽量Webフレームワーク
- **OpenAI API** - AI機能
- **LangGraph** - エージェントフレームワーク
- **Stripe** - 決済処理

### データベース
- **PostgreSQL** - リレーショナルデータベース
- **Prisma 5.x** - 型安全なORM

## 📁 プロジェクト構成

```
agent/
├── packages/
│   ├── agent/           # フロントエンド + AI Service Worker
│   │   ├── src/         # SolidJSフロントエンド
│   │   │   ├── components/  # UIコンポーネント
│   │   │   ├── pages/       # ページ
│   │   │   ├── types/       # 型定義
│   │   │   └── utils/       # ユーティリティ
│   │   └── worker/      # AI Service (Cloudflare Workers)
│   │       ├── ai/          # AIエージェント (LangGraph)
│   │       ├── api/         # REST API
│   │       ├── auth/        # Google/LINE OAuth & MCP トークン発行
│   │       └── payment/     # 決済処理 (Stripe)
│   │
│   ├── mcp-server/      # MCP Server (新規・独立)
│   │   └── worker/      # MCP Server Worker
│   │       ├── auth/        # MCP独自認証 & トークン検証
│   │       ├── mcp/         # MCPツール & ミドルウェア
│   │       │   └── tools/   # 各種ツール実装
│   │       │       ├── booking.ts  # 予約システム
│   │       │       ├── product.ts  # 商品管理
│   │       │       ├── order.ts    # 注文管理
│   │       │       └── form.ts     # フォーム管理
│   │       └── index.ts     # エントリーポイント
│   │
│   └── database/        # データベース層
│       ├── prisma/      # Prismaスキーマ
│       └── src/         # DBサービス
├── docs/                # ドキュメント
│   ├── guides/          # セットアップ & 利用ガイド
│   ├── reports/         # 実装レポート
│   ├── architecture/    # システム設計
│   └── planning/        # 企画・要件
└── README.md            # このファイル
```

## 🚀 クイックスタート

### 前提条件

- Node.js 20以上
- PostgreSQL 14以上
- npm
- OpenAI APIキー (AI機能使用時)
- Stripe APIキー (決済機能使用時)

### 1. インストール

```powershell
# リポジトリをクローン
git clone <repository-url>
cd agent

# 依存関係のインストール
npm install
```

### 2. 環境変数の設定

**データベース設定** (`packages/database/.env`):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/agent"
```

**アプリケーション設定** (`packages/agent/.dev.vars`):
```env
# OpenAI API Key (必須)
OPENAI_API_KEY=sk-your-openai-api-key

# Database URL
DATABASE_URL="postgresql://user:password@localhost:5432/agent"

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback/google

# Stripe Keys (決済機能使用時)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# MCP Token Signing (RS256秘密鍵)
# 生成方法: openssl genrsa -out private_key.pem 2048
MCP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# MCP Server URL
MCP_SERVER_URL=http://localhost:8788
```

**MCPサーバー設定** (`packages/mcp-server/.dev.vars`):
```env
# Google OAuth for MCP Administrators
MCP_GOOGLE_CLIENT_ID=your-google-client-id
MCP_GOOGLE_CLIENT_SECRET=your-google-client-secret
MCP_GOOGLE_REDIRECT_URI=http://localhost:8788/auth/callback/google

# AI Service Public Key (RS256公開鍵)
# 生成方法: openssl rsa -in private_key.pem -pubout -out public_key.pem
AI_SERVICE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Database URL
DATABASE_URL="postgresql://user:password@localhost:5432/agent"

# CORS設定
ALLOWED_ORIGINS=http://localhost:8787,http://localhost:5173
```

### 3. データベースのセットアップ

```powershell
# Prismaクライアント生成
npm run db:generate

# スキーマをDBにプッシュ
npm run db:push

# サンプルデータ投入 (オプション)
npm run db:seed
```

### 4. 開発サーバーの起動

```powershell
# AIサービスを起動 (ポート 8787)
cd packages/agent
npm run dev

# 別のターミナルでMCPサーバーを起動 (ポート 8788)
cd packages/mcp-server
npm run dev
```

これにより以下が起動します:
- AIサービス (フロントエンド + API): http://localhost:8787
- MCPサーバー (ツールAPI): http://localhost:8788
- Prisma Studio: http://localhost:5555 (別ターミナルで`npm run db:studio`)

### 5. ビルド

```powershell
# 本番ビルド
npm run build

# デプロイ
cd packages/agent
npm run deploy
```

## 📚 ドキュメント

### ガイド
- [AI統合ガイド](./docs/guides/AI_INTEGRATION.md) - OpenAI/LangGraphの使い方
- [決済統合ガイド](./docs/guides/PAYMENT_INTEGRATION.md) - Stripe決済の実装方法
- [MCP利用ガイド](./docs/guides/MCP_USAGE.md) - 利用者・管理者向け機能と外部API統合
- [クイックスタート](./docs/guides/QUICKSTART.md) - 詳細なセットアップガイド

### レポート
- [実装完了レポート](./docs/reports/IMPLEMENTATION_REPORT.md) - 開発セッションのまとめ
- [OAuth認証実装完了報告](./docs/reports/AUTH_IMPLEMENTATION.md) - 認証機能の実装状況
- [プロジェクト実装サマリー](./docs/reports/SUMMARY.md) - 実装状況と機能一覧
- [実装完了のお知らせ](./docs/reports/GETTING_STARTED.md) - PLANに基づく進捗報告

### 設計・企画
- [アーキテクチャ概要](./docs/architecture/ARCHITECTURE.md) - システムアーキテクチャ
- [プロジェクト計画](./docs/planning/PLAN.md) - 企画と要件定義

## 🔌 主なAPIエンドポイント

### AI Service (localhost:8787)

#### Authentication
- `GET /auth/login/google` - Google OAuth login
- `GET /auth/login/line` - LINE OAuth login
- `GET /auth/callback/google` - Google OAuth callback
- `GET /auth/callback/line` - LINE OAuth callback
- `GET /auth/me` - Get current user info
- `POST /auth/mcp-token` - Generate MCP access token
- `POST /auth/logout` - Logout

#### AI Chat
- `POST /api/conversations/:id/messages` - メッセージ送信
- `POST /api/conversations/:id/messages/stream` - ストリーミングレスポンス

#### 決済
- `POST /api/orders` - 注文作成
- `POST /api/checkout/session` - Checkoutセッション作成
- `POST /api/webhooks/stripe` - Stripeウェブフック

### MCP Server (localhost:8788)

#### Authentication
- `GET /auth/login/google` - Administrator login (MCP管理者用)
- `GET /auth/callback/google` - OAuth callback
- `POST /auth/verify-token` - Verify AI Service token
- `GET /auth/me` - Get current admin info

#### MCP Tools
- `GET /mcp` - API overview
- `GET /mcp/tools` - 利用可能なツール一覧

#### 予約システム
- `GET /mcp/tools/booking/available-slots` - [公開] 予約枠確認
- `POST /mcp/tools/booking/create` - [利用者] 予約作成
- `GET /mcp/tools/booking/:id` - [利用者] 予約詳細
- `POST /mcp/tools/booking/:id/cancel` - [利用者] 予約キャンセル
- `POST /mcp/tools/booking/service/create` - [管理者] サービス作成
- `GET /mcp/tools/booking` - [管理者] 全予約一覧

#### 商品管理
- `GET /mcp/tools/product/search` - [公開] 商品検索
- `GET /mcp/tools/product/:id` - [公開] 商品詳細
- `POST /mcp/tools/product/create` - [管理者] 商品作成
- `PUT /mcp/tools/product/:id` - [管理者] 商品更新
- `DELETE /mcp/tools/product/:id` - [管理者] 商品削除

#### 注文管理
- `POST /mcp/tools/order/create` - [利用者] 注文作成
- `GET /mcp/tools/order/:id` - [利用者] 注文確認
- `GET /mcp/tools/order/user/history` - [利用者] 注文履歴
- `POST /mcp/tools/order/:id/cancel` - [利用者] 注文キャンセル
- `GET /mcp/tools/order` - [管理者] 全注文確認
- `PUT /mcp/tools/order/:id/status` - [管理者] ステータス更新

#### フォーム
- `GET /mcp/tools/form/:id` - [公開] フォーム表示
- `POST /mcp/tools/form/:id/submit` - [利用者] フォーム送信
- `POST /mcp/tools/form/create` - [管理者] フォーム作成
- `PUT /mcp/tools/form/:id` - [管理者] フォーム更新
- `GET /mcp/tools/form/:id/submissions` - [管理者] 回答一覧
- `DELETE /mcp/tools/form/:id` - [管理者] フォーム削除

## 🤖 AIツール

AIエージェントが使用できるツール(利用者・管理者両方):

### 1. **booking_tool** - 予約システム
- **利用者**: 予約枠確認、予約作成、キャンセル
- **管理者**: サービス作成、全予約管理

### 2. **product_tool** - 商品カタログ
- **利用者**: 商品検索、閲覧
- **管理者**: 商品作成、更新、削除

### 3. **order_tool** - 注文管理
- **利用者**: 注文作成、履歴確認、キャンセル
- **管理者**: 全注文管理、ステータス更新

### 4. **form_tool** - フォーム
- **利用者**: フォーム表示、回答送信
- **管理者**: フォーム作成、回答確認、管理

詳細は[MCP利用ガイド](./docs/guides/MCP_USAGE.md)を参照。

## 🧪 テスト

```powershell
# ユニットテスト (実装予定)
npm test

# E2Eテスト (実装予定)
npm run test:e2e
```

## 📦 利用可能なコマンド

```powershell
# 開発
npm run dev              # 全サービス起動
npm run dev:agent        # Agentのみ起動
npm run dev:database     # DBビルド監視

# ビルド
npm run build            # 全体ビルド
npm run build:agent      # Agentビルド
npm run build:database   # DBビルド

# データベース
npm run db:generate      # Prismaクライアント生成
npm run db:push          # スキーマプッシュ
npm run db:seed          # サンプルデータ投入
npm run db:studio        # Prisma Studio起動

# デプロイ
cd packages/agent
npm run deploy           # Cloudflare Workersへデプロイ
```

## 🎯 次のステップ

- [x] AIサービスとMCPサーバーの分離アーキテクチャ実装
- [x] トークンベース認証システム (JWT with RS256)
- [x] MCP独自Google OAuth for 管理者
- [ ] データベースとの完全統合 (Prismaスキーマ更新)
- [ ] AIエージェントからMCPサーバーへの連携
- [ ] 管理画面の実装
- [ ] ダッシュボード・分析機能
- [ ] メール通知
- [ ] ファイルアップロード
- [ ] 多言語対応

## 🤝 コントリビューション

コントリビューションを歓迎します!

## 📄 ライセンス

MIT

## 🔗 参考リンク

- [SolidJS Documentation](https://www.solidjs.com/)
- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)

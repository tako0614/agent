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
│   ├── agent/           # フロントエンド + Worker
│   │   ├── src/         # SolidJSフロントエンド
│   │   │   ├── components/  # UIコンポーネント
│   │   │   ├── pages/       # ページ
│   │   │   ├── types/       # 型定義
│   │   │   └── utils/       # ユーティリティ
│   │   └── worker/      # Cloudflare Workers
│   │       ├── ai/          # AIエージェント
│   │       ├── api/         # REST API
│   │       ├── mcp/         # MCPツール
│   │       └── payment/     # 決済処理
│   └── database/        # データベース層
│       ├── prisma/      # Prismaスキーマ
│       └── src/         # DBサービス
├── docs/                # ドキュメント
│   ├── guides/          # セットアップ & 利用ガイド
│   ├── reports/         # 実装レポート
│   ├── architecture/    # システム設計
│   └── planning/        # 企画・要件
└── package.json         # ルートパッケージ
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

# Stripe Keys (決済機能使用時)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
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
# 全サービス起動
npm run dev
```

これにより以下が起動します:
- フロントエンド: http://localhost:8787
- API: http://localhost:8787/api
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

### AI Chat
- `POST /api/conversations/:id/messages` - メッセージ送信
- `POST /api/conversations/:id/messages/stream` - ストリーミングレスポンス

### MCP Tools (利用者・管理者共通)
- `GET /mcp` - API概要とドキュメント
- `GET /mcp/tools` - 利用可能なツール一覧

#### 予約システム
- `GET /mcp/tools/booking/available-slots` - [利用者] 予約枠確認
- `POST /mcp/tools/booking/create` - [利用者] 予約作成
- `POST /mcp/tools/booking/service/create` - [管理者] サービス作成

#### 商品管理
- `GET /mcp/tools/product/search` - [利用者] 商品検索
- `GET /mcp/tools/product/:id` - [利用者] 商品詳細
- `POST /mcp/tools/product/create` - [管理者] 商品作成

#### 注文管理
- `POST /mcp/tools/order/create` - [利用者] 注文作成
- `GET /mcp/tools/order/:id` - [利用者] 注文確認
- `GET /mcp/tools/order/list` - [管理者] 全注文確認

#### フォーム
- `GET /mcp/tools/form/:id` - [利用者] フォーム表示
- `POST /mcp/tools/form/:id/submit` - [利用者] フォーム送信
- `POST /mcp/tools/form/create` - [管理者] フォーム作成

### 決済
- `POST /api/orders` - 注文作成
- `POST /api/checkout/session` - Checkoutセッション作成
- `POST /api/webhooks/stripe` - Stripeウェブフック

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

- [ ] データベースとの完全統合
- [ ] ユーザー認証機能
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

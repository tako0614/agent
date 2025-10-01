# アーキテクチャ概要

## システム構成(分離アーキテクチャ)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ユーザー                                     │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     フロントエンド (SolidJS)                              │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  App.tsx - チャットUIメインコンポーネント                  │           │
│  │  ├─ MessageBubble - メッセージ表示                        │           │
│  │  ├─ ChatInput - メッセージ入力                            │           │
│  │  ├─ LoadingSpinner - ローディング表示                     │           │
│  │  ├─ LoginButton - Google/LINE認証ボタン                   │           │
│  │  └─ UserProfile - ユーザープロフィール                     │           │
│  └──────────────────────────────────────────────────────────┘           │
└────────────────────────┬────────────────────────────────────────────────┘
                         │ HTTP/Fetch API
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              AIサービス Workers (Hono)                                    │
│              Domain: ai-service.example.com                              │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  worker/index.ts - メインエントリーポイント                │           │
│  │  ├─ auth/ - 認証システム(Google/LINE OAuth)              │           │
│  │  │  ├─ /auth/login/google                                │           │
│  │  │  ├─ /auth/login/line                                  │           │
│  │  │  ├─ /auth/callback/google                             │           │
│  │  │  └─ /auth/callback/line                               │           │
│  │  ├─ api/ - RESTful APIエンドポイント                      │           │
│  │  │  ├─ /conversations - 会話管理                         │           │
│  │  │  ├─ /services - サービス管理                          │           │
│  │  │  └─ /ai - AIエージェント処理(LangGraph)               │           │
│  │  └─ payment/ - Stripe決済処理                            │           │
│  └──────────────────────────────────────────────────────────┘           │
│                         │                                                │
│                         │ トークン発行・管理                              │
│                         ▼                                                │
│         ┌──────────────────────────────┐                                │
│         │ JWT/Session Token Manager    │                                │
│         └──────────────────────────────┘                                │
└────────────────────────┬────────────────────────────────────────────────┘
                         │ HTTPリクエスト + AIサービストークン
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              MCPサーバー Workers (Hono)                                   │
│              Domain: mcp-api.example.com                                 │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  worker/index.ts - MCPエントリーポイント                   │           │
│  │  ├─ auth/ - MCP独自認証(Google OAuth)                     │           │
│  │  │  ├─ /auth/login/google - 開発者/管理者向け             │           │
│  │  │  └─ /auth/verify-token - AIサービストークン検証        │           │
│  │  ├─ mcp/ - MCP Tools API                                  │           │
│  │  │  ├─ booking tools - 予約システム                       │           │
│  │  │  ├─ product tools - 商品管理                           │           │
│  │  │  ├─ order tools - 注文管理                             │           │
│  │  │  └─ form tools - フォーム管理                          │           │
│  │  └─ middleware/ - 認証ミドルウェア                         │           │
│  │     ├─ AIサービストークン検証                              │           │
│  │     └─ MCP自体のGoogle認証検証                            │           │
│  └──────────────────────────────────────────────────────────┘           │
└────────────────────────┬────────────────────────────────────────────────┘
                         │ Prisma ORM
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                                 │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  ■ AIサービス用テーブル:                                   │           │
│  │  ├─ users - ユーザー情報(Google/LINE認証)                 │           │
│  │  ├─ sessions - セッション管理                              │           │
│  │  ├─ access_tokens - MCPアクセストークン                    │           │
│  │  ├─ conversations / messages - 会話履歴                    │           │
│  │  └─ payments - 決済情報                                    │           │
│  │                                                            │           │
│  │  ■ MCP用テーブル:                                          │           │
│  │  ├─ mcp_users - MCP管理者/開発者アカウント                │           │
│  │  ├─ services - サービス定義                                │           │
│  │  ├─ bookings - 予約データ                                  │           │
│  │  ├─ products - 商品データ                                  │           │
│  │  ├─ orders / order_items - 注文データ                      │           │
│  │  ├─ forms / form_submissions - フォームデータ              │           │
│  │  └─ logs - システムログ                                    │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

## データフロー

### 1. ユーザーのログインフロー

```
User → フロントエンド → AIサービス認証エンドポイント
  → Google/LINE OAuth
    → コールバック
      → セッションCookie発行
        → ユーザー情報取得
```

### 2. AIサービス経由のMCP利用フロー

```
User Input → ChatInput Component → App.tsx
  → AIサービス '/api/conversations/:id/messages'
    → AI Agent処理 (LangGraph)
      → AIサービスがMCPアクセストークン生成
        → MCP API呼び出し (+ AIサービストークン)
          → MCPサーバーがトークン検証
            → MCP Tools実行
              → Database操作 (Prisma)
                → PostgreSQL
```

### 3. MCP直接アクセスフロー(開発者/管理者向け)

```
Developer → MCP Google認証
  → MCPセッション確立
    → MCP API直接呼び出し
      → MCP Tools実行
        → Database操作
          → PostgreSQL
```

### 4. サービス操作(例: 予約作成)

```
AI Agent → トークン取得
  → POST https://mcp-api.example.com/mcp/tools/booking/create
    + Authorization: Bearer <ai-service-token>
      → トークン検証
        → bookingService.create() (database/src/services.ts)
          → Prisma Client
            → PostgreSQL INSERT
```

## コンポーネント詳細

### フロントエンド層

**技術**: Vite + SolidJS + TailwindCSS

**役割**:
- ユーザーインターフェースの提供
- リアルタイムメッセージング
- Markdownレンダリング
- 認証UI (Google/LINE ログインボタン)

**主要ファイル**:
- `src/App.tsx` - メインアプリケーション
- `src/components/` - 再利用可能なUIコンポーネント
- `src/utils/api.ts` - APIクライアント
- `src/utils/auth.tsx` - 認証ヘルパー
- `src/types/index.ts` - TypeScript型定義

### AIサービスWorkers層

**技術**: Cloudflare Workers + Hono
**ドメイン**: `ai-service.example.com`

**役割**:
- ユーザー認証(Google/LINE OAuth)
- RESTful APIの提供
- AI Agent処理 (LangGraph)
- MCPサーバーとの連携(トークン発行・管理)
- 決済処理 (Stripe)
- CORS処理
- エラーハンドリング

**エンドポイント構成**:
- `/auth/*` - 認証関連
- `/api/*` - 標準的なRESTful API
- `/payment/*` - 決済関連

**認証機能**:
- Google OAuth 2.0
- LINE Login
- セッション管理(Cookie)
- MCPアクセストークン発行

### MCPサーバーWorkers層

**技術**: Cloudflare Workers + Hono
**ドメイン**: `mcp-api.example.com`

**役割**:
- MCP Tools APIの提供
- 2つの認証方式のサポート:
  1. AIサービスからのトークン検証
  2. 独自のGoogle OAuth(管理者/開発者向け)
- ビジネスロジック実行
- データベース操作

**エンドポイント構成**:
- `/auth/*` - MCP独自認証
- `/mcp/*` - MCP Tools API

**認証機能**:
- AIサービス発行トークンの検証
- 独自Google OAuth(開発者/管理者用)
- APIキー認証(オプション)

### データベース層

**技術**: Prisma + PostgreSQL

**役割**:
- データの永続化
- トランザクション管理
- リレーションシップの管理
- 型安全なクエリ

**主要機能**:
- `services.ts` - ビジネスロジック層
- `client.ts` - Prismaクライアントインスタンス
- `seed.ts` - サンプルデータ投入

## セキュリティ考慮事項

### 認証の分離戦略

#### AIサービス側
- ✅ Google OAuth 2.0実装済み
- ✅ LINE Login実装済み
- ✅ セッションCookie管理
- ✅ CORS設定済み
- 🔄 MCPアクセストークンの発行・管理
- 🔄 トークンの有効期限管理
- 🔄 リフレッシュトークン対応

#### MCPサーバー側
- 🔄 AIサービストークン検証ミドルウェア
- 🔄 独自Google OAuth(管理者用)
- ✅ APIキー認証(オプション)
- ✅ エンドポイント別権限管理
- 🔄 レート制限
- 🔄 IPホワイトリスト(オプション)

### 実装済み

- ✅ CORS設定済み
- ✅ 型安全なAPI
- ✅ SQLインジェクション対策(Prisma使用)
- ✅ OAuth認証フロー

### 実装予定

- 🔄 AIサービス⇄MCP間のトークン認証
- 🔄 トークンの暗号化
- ⏳ レート制限
- ⏳ 入力バリデーション強化
- ⏳ HTTPS強制(本番環境)
- ⏳ データ暗号化(機密情報)

## スケーラビリティ

### 現在のアーキテクチャの利点

1. **Cloudflare Workers**: エッジコンピューティングで低レイテンシ
2. **PostgreSQL**: 大規模データにも対応可能
3. **Prisma**: コネクションプーリングで効率的なDB接続

### 将来的な拡張

1. **キャッシング**: Redis/Cloudflare KVの導入
2. **非同期処理**: Cloudflare Queuesの活用
3. **ファイルストレージ**: Cloudflare R2の統合
4. **CDN**: 静的アセットの配信最適化

## 開発ワークフロー

```
1. スキーマ変更
   ↓
2. prisma generate
   ↓
3. データベースマイグレーション
   ↓
4. サービス層実装
   ↓
5. API実装
   ↓
6. フロントエンド統合
   ↓
7. テスト
   ↓
8. デプロイ
```

## モニタリングとログ

現在:
- `logs`テーブルでログ保存
- コンソールログ出力

将来:
- Cloudflare Analytics
- Sentry/DataDogなどの外部サービス
- カスタムダッシュボード

## パフォーマンス最適化

### フロントエンド
- SolidJSの高速なリアクティビティ
- コード分割
- 画像最適化

### バックエンド
- Cloudflare Workersの低レイテンシ
- データベースインデックス
- クエリ最適化

### データベース
- 適切なインデックス設定
- クエリプラン分析
- コネクションプーリング

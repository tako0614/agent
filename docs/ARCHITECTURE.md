# アーキテクチャ概要

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                         ユーザー                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  フロントエンド (SolidJS)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  App.tsx - チャットUIメインコンポーネント              │    │
│  │  ├─ MessageBubble - メッセージ表示                   │    │
│  │  ├─ ChatInput - メッセージ入力                       │    │
│  │  └─ LoadingSpinner - ローディング表示                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/Fetch API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             Cloudflare Workers (Hono)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  worker/index.ts - メインエントリーポイント            │   │
│  │  ├─ api/ - RESTful APIエンドポイント                 │   │
│  │  │  ├─ /conversations - 会話管理                     │   │
│  │  │  ├─ /services - サービス管理                      │   │
│  │  │  ├─ /bookings - 予約管理                          │   │
│  │  │  ├─ /products - 商品管理                          │   │
│  │  │  ├─ /orders - 注文管理                            │   │
│  │  │  └─ /forms - フォーム管理                         │   │
│  │  └─ mcp/ - AI Agent用ツールエンドポイント            │   │
│  │     ├─ booking tools                                 │   │
│  │     ├─ product tools                                 │   │
│  │     ├─ order tools                                   │   │
│  │     └─ form tools                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ Prisma ORM
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  テーブル:                                             │   │
│  │  ├─ users - ユーザー情報                              │   │
│  │  ├─ agents - AIエージェント                          │   │
│  │  ├─ tasks - タスク                                    │   │
│  │  ├─ services - サービス定義                           │   │
│  │  ├─ bookings - 予約データ                             │   │
│  │  ├─ products - 商品データ                             │   │
│  │  ├─ orders / order_items - 注文データ                 │   │
│  │  ├─ forms / form_submissions - フォームデータ         │   │
│  │  ├─ conversations / messages - 会話履歴               │   │
│  │  └─ logs - システムログ                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## データフロー

### 1. ユーザーがメッセージを送信

```
User Input → ChatInput Component → App.tsx
  → fetch('/api/conversations/:id/messages')
    → Cloudflare Worker (api/index.ts)
      → (将来) AI Agent処理 (LangGraph)
        → MCP Tools呼び出し
          → Database操作 (Prisma)
            → PostgreSQL
```

### 2. サービス操作(例: 予約作成)

```
AI Agent → POST /mcp/tools/booking/create
  → mcp/index.ts handler
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

**主要ファイル**:
- `src/App.tsx` - メインアプリケーション
- `src/components/` - 再利用可能なUIコンポーネント
- `src/utils/api.ts` - APIクライアント
- `src/types/index.ts` - TypeScript型定義

### APIレイヤー

**技術**: Cloudflare Workers + Hono

**役割**:
- RESTful APIの提供
- リクエストのルーティング
- CORS処理
- エラーハンドリング

**エンドポイント構成**:
- `/api/*` - 標準的なRESTful API
- `/mcp/*` - AI Agent専用ツールAPI

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

### 現在の実装

- ✅ CORS設定済み
- ✅ 型安全なAPI
- ✅ SQLインジェクション対策(Prisma使用)

### 今後の実装予定

- ⏳ 認証・認可(JWT/OAuth)
- ⏳ レート制限
- ⏳ 入力バリデーション
- ⏳ HTTPS強制
- ⏳ APIキー管理
- ⏳ データ暗号化

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

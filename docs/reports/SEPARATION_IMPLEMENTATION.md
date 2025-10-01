# 分離アーキテクチャ実装完了報告

## 📋 実装概要

**日付**: 2025年10月2日  
**アーキテクチャ**: AIサービスとMCPサーバーの完全分離  
**認証方式**: JWT (RS256) トークンベース認証

## 🎯 実装内容

### 1. 新規プロジェクト作成: MCP Server

```
packages/mcp-server/
├── worker/
│   ├── auth/
│   │   ├── index.ts          # Google OAuth for 管理者
│   │   └── verify.ts         # JWT トークン検証
│   ├── mcp/
│   │   ├── index.ts          # MCPルーター
│   │   ├── middleware.ts     # 認証ミドルウェア
│   │   └── tools/            # ビジネスツール
│   │       ├── booking.ts    # 予約システム
│   │       ├── product.ts    # 商品管理
│   │       ├── order.ts      # 注文管理
│   │       └── form.ts       # フォーム管理
│   └── index.ts              # エントリーポイント
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

### 2. AI Service の拡張

#### 新規ファイル
- `worker/auth/mcp-token.ts` - MCPトークン生成機能

#### 更新ファイル
- `worker/api/auth.ts` - `/auth/mcp-token` エンドポイント追加
- `package.json` - `jose` パッケージ追加
- `.dev.vars.example` - MCP関連環境変数追加

### 3. ドキュメント更新

- `README.md` - プロジェクト構成と起動方法を更新
- `docs/guides/SETUP_GUIDE.md` - 新規作成: 詳細セットアップガイド

## 🔐 認証フロー

### エンドユーザー (AI Service経由)

```
1. User → AI Service: Google/LINE OAuth ログイン
2. AI Service → User: セッションCookie発行
3. User → AI Service: /auth/mcp-token リクエスト
4. AI Service → User: JWT トークン返却
5. User → MCP Server: Bearer Token で API呼び出し
6. MCP Server: トークン検証 → ツール実行
```

### 管理者 (MCP Server直接アクセス)

```
1. Admin → MCP Server: Google OAuth ログイン
2. MCP Server → Admin: セッションCookie発行
3. Admin → MCP Server: Cookie で API呼び出し
4. MCP Server: セッション検証 → 管理機能実行
```

## 🛠️ 実装した機能

### MCP Server

#### 認証システム
- ✅ Google OAuth for 管理者
- ✅ JWT トークン検証 (RS256)
- ✅ デュアル認証サポート (トークン + セッション)
- ✅ スコープベースのアクセス制御

#### ビジネスツール

**予約システム (Booking)**
- ✅ 予約枠確認 (公開)
- ✅ 予約作成・詳細・キャンセル (認証必要)
- ✅ サービス作成・全予約一覧 (管理者のみ)

**商品管理 (Product)**
- ✅ 商品検索・詳細 (公開)
- ✅ 商品作成・更新・削除 (管理者のみ)

**注文管理 (Order)**
- ✅ 注文作成・確認・履歴 (認証必要)
- ✅ 全注文一覧・ステータス更新 (管理者のみ)

**フォーム (Form)**
- ✅ フォーム表示 (公開)
- ✅ フォーム送信 (認証必要)
- ✅ フォーム作成・更新・削除・回答一覧 (管理者のみ)

### AI Service

#### 認証拡張
- ✅ MCP トークン生成エンドポイント (`/auth/mcp-token`)
- ✅ RS256 署名によるJWT生成
- ✅ スコープ付きトークン発行

## 📊 スコープ定義

### エンドユーザースコープ
```
booking:read, booking:create, booking:cancel
product:read
order:read, order:create, order:cancel
form:read, form:submit
```

### 管理者スコープ
```
booking:*, booking:admin
product:*, product:admin
order:*, order:admin
form:*, form:admin
```

## 🚀 起動方法

### 開発環境

**ターミナル1: AI Service**
```powershell
cd packages/agent
npm run dev
# → http://localhost:8787
```

**ターミナル2: MCP Server**
```powershell
cd packages/mcp-server
npm run dev
# → http://localhost:8788
```

### 環境変数セットアップ

**AI Service** (`.dev.vars`)
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MCP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
MCP_SERVER_URL=http://localhost:8788
```

**MCP Server** (`.dev.vars`)
```env
DATABASE_URL=postgresql://...
MCP_GOOGLE_CLIENT_ID=...
MCP_GOOGLE_CLIENT_SECRET=...
AI_SERVICE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALLOWED_ORIGINS=http://localhost:8787
```

## 🔑 RSA鍵ペアの生成

```powershell
# 秘密鍵生成 (AI Service用)
openssl genrsa -out private_key.pem 2048

# 公開鍵抽出 (MCP Server用)
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

## 📝 APIエンドポイント

### AI Service (`:8787`)
- `POST /auth/mcp-token` - MCP トークン生成
- `GET /auth/me` - ユーザー情報取得
- `POST /api/conversations/:id/messages` - AI チャット

### MCP Server (`:8788`)
- `GET /mcp` - API概要
- `GET /mcp/tools` - ツール一覧
- `GET /mcp/tools/booking/available-slots` - 予約枠確認
- `POST /mcp/tools/booking/create` - 予約作成
- `GET /mcp/tools/product/search` - 商品検索
- `POST /mcp/tools/order/create` - 注文作成
- `GET /mcp/tools/form/:id` - フォーム取得
- その他多数...

## ⚠️ 残作業

### 高優先度
- [ ] データベース統合 (Prismaスキーマ更新)
- [ ] AIエージェントからMCPサーバーへのHTTPリクエスト実装
- [ ] エラーハンドリングの強化
- [ ] ロギング機能の実装

### 中優先度
- [ ] トークンリフレッシュ機能
- [ ] レート制限の実装
- [ ] ユニットテストの追加
- [ ] E2Eテストの追加

### 低優先度
- [ ] 管理画面UI
- [ ] ダッシュボード
- [ ] メール通知
- [ ] ファイルアップロード

## 📚 参考ドキュメント

- [セットアップガイド](./guides/SETUP_GUIDE.md)
- [MCP認証ガイド](./guides/MCP_AUTH.md)
- [分離アーキテクチャ詳細](./architecture/SEPARATION_ARCHITECTURE.md)
- [プロジェクト計画](./planning/PLAN.md)

## 🎉 まとめ

分離アーキテクチャの基盤実装が完了しました!

**実装されたもの:**
- ✅ 独立したMCPサーバープロジェクト
- ✅ トークンベース認証 (JWT/RS256)
- ✅ デュアル認証システム
- ✅ 4つのビジネスツール (予約/商品/注文/フォーム)
- ✅ スコープベースのアクセス制御
- ✅ 完全なAPIエンドポイント

**次のステップ:**
1. RSA鍵ペアを生成
2. 環境変数を設定
3. 両方のサーバーを起動
4. 動作確認
5. データベース統合を進める

詳細なセットアップ方法は [SETUP_GUIDE.md](./guides/SETUP_GUIDE.md) を参照してください。

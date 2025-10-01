# MCP認証システムの実装

## 概要

MCP (Model Context Protocol) サーバーに柔軟な認証システムを実装しました。以下の3つの認証方法をサポートします:

### 認証方法

1. **セッションCookie認証** (ログインユーザー向け)
   - GoogleまたはLINEでログインしたユーザー
   - HttpOnly Cookieでセッション管理
   - ユーザー固有のデータにアクセス可能

2. **APIキー認証** (外部アプリケーション/管理者向け)
   - `Authorization: Bearer YOUR_API_KEY`ヘッダーで認証
   - 管理者権限が必要なエンドポイントにアクセス可能
   - 外部システムからの統合に使用

3. **公開アクセス** (認証不要)
   - 商品検索、フォーム表示など公開エンドポイント
   - 誰でもアクセス可能

## 実装されたファイル

### 1. `worker/mcp/middleware.ts` - 認証ミドルウェア

```typescript
// 使い方
app.get('/public', publicEndpoint, async (c) => {
  // 認証不要、誰でもアクセス可能
});

app.post('/user/action', requireAuth, async (c) => {
  // セッションまたはAPIキー認証が必要
  const userId = getCurrentUserId(c);
});

app.delete('/admin/action', requireAdmin, async (c) => {
  // 管理者権限(APIキー)が必要
});
```

### 2. `worker/mcp/account.ts` - アカウント管理

外部からMCP経由でアカウント作成・管理が可能:

#### ユーザー向けエンドポイント

- `POST /mcp/account/register` - 新規アカウント作成
- `GET /mcp/account/me` - 自分のアカウント情報取得  
- `PUT /mcp/account/update` - アカウント情報更新
- `DELETE /mcp/account/delete` - アカウント削除

#### 管理者向けエンドポイント (API Key必須)

- `GET /mcp/account/list` - 全アカウント一覧
- `PUT /mcp/account/:userId/role` - ユーザー権限変更
- `DELETE /mcp/account/:userId` - ユーザー削除

### 3. 各種MCPエンドポイント

すべてのMCPエンドポイントが適切な認証レベルを持ちます:

```
[PUBLIC] - 誰でもアクセス可能
[AUTH] - ログインユーザーまたはAPIキー
[ADMIN] - APIキーのみ
```

## 使用例

### 1. 外部アプリケーションからアカウント作成

```javascript
// 新規ユーザー登録
const response = await fetch('http://localhost:8787/mcp/account/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    name: 'John Doe',
    provider: 'email'
  })
});

const result = await response.json();
console.log(result);
// {
//   success: true,
//   data: {
//     user: { id, email, name, provider },
//     message: 'Account created successfully'
//   }
// }

// セッションCookieが自動的に設定される
```

### 2. セッション認証でMCPエンドポイントを使用

```javascript
// ログイン後、セッションCookieで自動認証
const response = await fetch('http://localhost:8787/mcp/tools/booking/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // Cookieを含める
  body: JSON.stringify({
    serviceId: 'srv_123',
    date: '2025-10-15',
    time: '10:00',
    customerName: 'John Doe',
    customerEmail: 'john@example.com'
  })
});
```

### 3. APIキーで管理機能を使用

```javascript
// 管理者用エンドポイント
const response = await fetch('http://localhost:8787/mcp/tools/product/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_MCP_API_KEY'
  },
  body: JSON.stringify({
    name: 'New Product',
    description: 'Product description',
    price: 1000,
    stock: 100
  })
});
```

### 4. 公開エンドポイントを使用

```javascript
// 認証不要
const response = await fetch('http://localhost:8787/mcp/tools/product/search?q=laptop');
const products = await response.json();
```

## 認証フロー

### ログインユーザーの場合

1. `/auth/login/google`または`/auth/login/line`でログイン
2. OAuth認証完了後、セッションCookie が設定される
3. 以降のリクエストで自動的に認証される
4. MCPエンドポイントにアクセス時、ミドルウェアがCookieを検証
5. ユーザーIDがコンテキストに設定される

### 外部アプリケーションの場合

1. MCP_API_KEYを環境変数またはCloudflare Secretsに設定
2. リクエストヘッダーに`Authorization: Bearer YOUR_KEY`を含める
3. 管理者権限でMCPエンドポイントにアクセス可能

### 公開アクセスの場合

1. 認証不要、直接エンドポイントにアクセス
2. 一部のユーザー情報は取得できない(匿名)

## セキュリティ機能

### 1. 認証レベルの分離

- **Public**: 誰でもアクセス可能、センシティブなデータは非表示
- **Auth**: ログインユーザーのみ、自分のデータにアクセス可能
- **Admin**: 管理者のみ、全データにアクセス可能

### 2. セッション管理

- HttpOnly Cookie (XSS保護)
- Secure属性 (HTTPS通信のみ)
- SameSite=Lax (CSRF保護)
- 7日間の有効期限

### 3. APIキー保護

- 環境変数で管理
- 本番環境ではCloudflare Secretsを使用
- リクエストごとに検証

## 環境変数

```.env
# MCP API Key (管理者用)
MCP_API_KEY=your-secret-api-key-here
```

本番環境:
```bash
wrangler secret put MCP_API_KEY
```

## エンドポイント一覧

### アカウント管理 (`/mcp/account/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/register` | POST | Public | 新規アカウント作成 |
| `/me` | GET | Auth | 自分の情報取得 |
| `/update` | PUT | Auth | 情報更新 |
| `/delete` | DELETE | Auth | アカウント削除 |
| `/list` | GET | Admin | 全ユーザー一覧 |
| `/:userId/role` | PUT | Admin | 権限変更 |
| `/:userId` | DELETE | Admin | ユーザー削除 |

### 予約 (`/mcp/tools/booking/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/service/create` | POST | Admin | サービス作成 |
| `/available-slots` | GET | Public | 空き枠検索 |
| `/create` | POST | Auth | 予約作成 |
| `/:id` | GET | Auth | 予約詳細 |
| `/:id` | DELETE | Auth | 予約キャンセル |
| `/service/:id/bookings` | GET | Admin | サービスの全予約 |

### 商品 (`/mcp/tools/product/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | Admin | 商品作成 |
| `/search` | GET | Public | 商品検索 |
| `/:id` | GET | Public | 商品詳細 |
| `/list` | GET | Public | 商品一覧 |
| `/:id` | PUT | Admin | 商品更新 |
| `/:id` | DELETE | Admin | 商品削除 |

### 注文 (`/mcp/tools/order/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | Auth | 注文作成 |
| `/:id` | GET | Auth | 注文詳細 |
| `/user/list` | GET | Auth | 自分の注文一覧 |
| `/:id` | DELETE | Auth | 注文キャンセル |
| `/list` | GET | Admin | 全注文一覧 |
| `/:id/status` | PUT | Admin | ステータス更新 |

### フォーム (`/mcp/tools/form/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | Admin | フォーム作成 |
| `/:id` | GET | Public | フォーム取得 |
| `/:id/submit` | POST | Public | 送信 |
| `/:id/submissions` | GET | Admin | 送信一覧 |
| `/submission/:id` | GET | Admin | 送信詳細 |
| `/list` | GET | Admin | フォーム一覧 |
| `/:id` | PUT | Admin | フォーム更新 |
| `/:id` | DELETE | Admin | フォーム削除 |

## 今後の拡張

### データベース統合

現在はモックデータを返していますが、Prismaを使ってデータベースに接続:

```typescript
// Userモデルの追加
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  picture    String?
  provider   String
  providerId String
  role       String   @default("user") // "user" or "admin"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  bookings      Booking[]
  orders        Order[]
  conversations Conversation[]

  @@unique([provider, providerId])
}
```

### ロールベースアクセス制御(RBAC)

- ユーザー、管理者、スーパー管理者など複数の権限レベル
- きめ細かな権限管理

### レート制限

- API呼び出し回数の制限
- 悪用防止

### 監査ログ

- すべてのMCP操作を記録
- セキュリティ監視

## トラブルシューティング

### セッション認証が機能しない

1. Cookieが設定されているか確認
2. CORS設定で`credentials: true`が有効か確認
3. フロントエンドで`credentials: 'include'`を指定

### APIキー認証が失敗する

1. MCP_API_KEYが環境変数に設定されているか確認
2. `Authorization`ヘッダーの形式が正しいか確認: `Bearer YOUR_KEY`
3. Cloudflare Secretsが本番環境で設定されているか確認

## 参考資料

- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) - OAuth認証の詳細
- [MCP_USAGE.md](./MCP_USAGE.md) - MCPエンドポイントの使い方
- [Hono Middleware](https://hono.dev/docs/guides/middleware)

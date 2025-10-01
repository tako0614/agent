# MCPサーバー利用ガイド

## 概要

このプロジェクトのMCPサーバーは、**管理者側**と**利用者側**の両方の機能を提供します。さらに、外部アプリケーションからも利用可能です。

## 3つの利用方法

### 1. 内部AIエージェント
- フロントエンドのチャットUIから自然言語で操作
- AIが適切なツールとアクションを自動選択

### 2. 外部アプリケーション
- REST APIとして直接呼び出し
- APIキーによる認証(管理者機能のみ)

### 3. 直接統合
- フロントエンドアプリケーションから直接呼び出し
- 公開エンドポイントは認証不要

## エンドポイント一覧

### 📚 ドキュメント

```
GET /mcp
```

MCPサーバーの概要と利用可能なエンドポイントを取得

```
GET /mcp/tools
```

全ツールの詳細情報とカテゴリを取得

## 予約システム (Booking)

### 👥 利用者向け機能

#### 利用可能な予約枠を確認
```http
GET /mcp/tools/booking/available-slots?serviceId=srv_123&date=2025-10-15
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "availableSlots": [
      {
        "id": "slot_1",
        "start": "09:00",
        "end": "10:00",
        "available": true
      }
    ]
  }
}
```

#### 予約を作成
```http
POST /mcp/tools/booking/create
Content-Type: application/json

{
  "serviceId": "srv_123",
  "slotId": "slot_1",
  "date": "2025-10-15",
  "customerName": "山田太郎",
  "customerEmail": "yamada@example.com",
  "customerPhone": "090-1234-5678",
  "notes": "特記事項"
}
```

#### 予約詳細を確認
```http
GET /mcp/tools/booking/bkg_123456
```

#### 予約をキャンセル
```http
POST /mcp/tools/booking/bkg_123456/cancel
Content-Type: application/json

{
  "reason": "都合により"
}
```

### 🔧 管理者向け機能

#### 予約サービスを作成
```http
POST /mcp/tools/booking/service/create
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "ヘアカット",
  "description": "カット＋シャンプー",
  "duration": 60,
  "price": 3000
}
```

#### 全予約を確認
```http
GET /mcp/tools/booking/service/srv_123/bookings?status=CONFIRMED
Authorization: Bearer YOUR_API_KEY
```

## 商品管理 (Product)

### 👥 利用者向け機能

#### 商品を検索
```http
GET /mcp/tools/product/search?q=Tシャツ&category=衣料&minPrice=1000&maxPrice=5000
```

#### 商品一覧を取得
```http
GET /mcp/tools/product/list?limit=20&offset=0
```

#### 商品詳細を取得
```http
GET /mcp/tools/product/prd_123
```

### 🔧 管理者向け機能

#### 商品を作成
```http
POST /mcp/tools/product/create
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "オーガニックTシャツ",
  "description": "100%オーガニックコットン",
  "price": 2900,
  "stock": 50,
  "images": ["/images/tshirt1.jpg"],
  "category": "衣料"
}
```

#### 商品を更新
```http
PUT /mcp/tools/product/prd_123
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "price": 2500,
  "stock": 45
}
```

#### 商品を削除
```http
DELETE /mcp/tools/product/prd_123
Authorization: Bearer YOUR_API_KEY
```

## 注文管理 (Order)

### 👥 利用者向け機能

#### 注文を作成(購入)
```http
POST /mcp/tools/order/create
Content-Type: application/json

{
  "userId": "user_123",
  "items": [
    {
      "productId": "prd_123",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "name": "山田太郎",
    "phone": "090-1234-5678",
    "postalCode": "100-0001",
    "address": "東京都千代田区..."
  }
}
```

#### 注文詳細を確認
```http
GET /mcp/tools/order/ord_123456
```

#### 注文履歴を確認
```http
GET /mcp/tools/order/user/user_123/orders?status=SHIPPED
```

#### 注文をキャンセル
```http
POST /mcp/tools/order/ord_123456/cancel
Content-Type: application/json

{
  "reason": "サイズが合わない"
}
```

### 🔧 管理者向け機能

#### 全注文を確認
```http
GET /mcp/tools/order/list?status=PENDING&limit=50
Authorization: Bearer YOUR_API_KEY
```

#### 注文ステータスを更新
```http
PUT /mcp/tools/order/ord_123456/status
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "status": "SHIPPED",
  "trackingNumber": "1234567890",
  "notes": "ヤマト運輸で発送しました"
}
```

## フォーム管理 (Form)

### 👥 利用者向け機能

#### フォームを取得(表示用)
```http
GET /mcp/tools/form/frm_123
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "id": "frm_123",
    "name": "お問い合わせフォーム",
    "description": "ご質問をお聞かせください",
    "fields": [
      {
        "id": "name",
        "type": "text",
        "label": "お名前",
        "required": true
      },
      {
        "id": "email",
        "type": "email",
        "label": "メールアドレス",
        "required": true
      },
      {
        "id": "message",
        "type": "textarea",
        "label": "メッセージ",
        "required": true
      }
    ]
  }
}
```

#### フォームに回答して送信
```http
POST /mcp/tools/form/frm_123/submit
Content-Type: application/json

{
  "data": {
    "name": "山田太郎",
    "email": "yamada@example.com",
    "message": "商品について質問があります"
  },
  "submitterName": "山田太郎",
  "submitterEmail": "yamada@example.com"
}
```

### 🔧 管理者向け機能

#### フォームを作成
```http
POST /mcp/tools/form/create
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "お問い合わせフォーム",
  "description": "ご質問やご要望をお聞かせください",
  "fields": [
    {
      "id": "name",
      "type": "text",
      "label": "お名前",
      "required": true
    },
    {
      "id": "email",
      "type": "email",
      "label": "メールアドレス",
      "required": true
    },
    {
      "id": "category",
      "type": "select",
      "label": "お問い合わせ種別",
      "required": true,
      "options": ["商品について", "配送について", "その他"]
    },
    {
      "id": "message",
      "type": "textarea",
      "label": "メッセージ",
      "required": true
    }
  ],
  "settings": {
    "enableNotifications": true,
    "notificationEmail": "support@example.com",
    "successMessage": "お問い合わせありがとうございました"
  }
}
```

#### フォーム一覧を取得
```http
GET /mcp/tools/form/list
Authorization: Bearer YOUR_API_KEY
```

#### 回答一覧を確認
```http
GET /mcp/tools/form/frm_123/submissions?limit=50&offset=0
Authorization: Bearer YOUR_API_KEY
```

#### フォームを更新
```http
PUT /mcp/tools/form/frm_123
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "更新されたフォーム名",
  "description": "新しい説明"
}
```

#### フォームを削除
```http
DELETE /mcp/tools/form/frm_123
Authorization: Bearer YOUR_API_KEY
```

## 認証

### 公開エンドポイント (認証不要)

利用者向け機能は基本的に認証不要:
- 予約の確認・作成・キャンセル
- 商品の検索・閲覧
- 注文の作成・確認
- フォームの表示・送信

### 管理者エンドポイント (認証必要)

管理者向け機能はAPIキーが必要:
- サービス・商品・フォームの作成・更新・削除
- 全予約・注文の管理
- フォーム回答の閲覧

### APIキーの設定

`.dev.vars`ファイルに追加:
```env
MCP_API_KEY=your-secret-api-key
```

本番環境:
```powershell
wrangler secret put MCP_API_KEY
```

### APIキーの使用

```http
Authorization: Bearer your-secret-api-key
```

## AI エージェントからの使用例

### ユーザー: 「明日の予約を確認したい」

AI Agent → `booking_tool` with action: `list_slots`
```json
{
  "action": "list_slots",
  "serviceId": "srv_123",
  "date": "2025-10-02"
}
```

### ユーザー: 「Tシャツを検索して」

AI Agent → `product_tool` with action: `search`
```json
{
  "action": "search",
  "query": "Tシャツ"
}
```

### ユーザー: 「この商品を2つ注文したい」

AI Agent → `order_tool` with action: `create`
```json
{
  "action": "create",
  "userId": "user_123",
  "items": [
    {
      "productId": "prd_123",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "name": "山田太郎",
    ...
  }
}
```

### 管理者: 「新しいフォームを作成して」

AI Agent → `form_tool` with action: `create`
```json
{
  "action": "create",
  "name": "お問い合わせフォーム",
  "fields": [...]
}
```

## 外部アプリケーションからの統合

### Node.js / JavaScript

```javascript
// 商品を検索
const response = await fetch('https://your-domain.com/mcp/tools/product/search?q=shirt', {
  headers: {
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// 注文を作成
const order = await fetch('https://your-domain.com/mcp/tools/order/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_123',
    items: [{ productId: 'prd_123', quantity: 1 }],
    shippingAddress: { ... }
  })
});
```

### Python

```python
import requests

# 商品を検索
response = requests.get(
    'https://your-domain.com/mcp/tools/product/search',
    params={'q': 'shirt'}
)
products = response.json()

# 注文を作成
order = requests.post(
    'https://your-domain.com/mcp/tools/order/create',
    json={
        'userId': 'user_123',
        'items': [{'productId': 'prd_123', 'quantity': 1}],
        'shippingAddress': { ... }
    }
)
```

### cURL

```bash
# 商品を検索
curl "https://your-domain.com/mcp/tools/product/search?q=shirt"

# 予約を作成
curl -X POST "https://your-domain.com/mcp/tools/booking/create" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "srv_123",
    "slotId": "slot_1",
    "date": "2025-10-15",
    "customerName": "山田太郎",
    "customerEmail": "yamada@example.com"
  }'

# 管理者機能 (APIキー必要)
curl "https://your-domain.com/mcp/tools/order/list" \
  -H "Authorization: Bearer your-api-key"
```

## まとめ

このMCPサーバーは:

✅ **利用者**: 予約、購入、フォーム送信など、サービスを利用できる  
✅ **管理者**: サービス、商品、フォームを作成・管理できる  
✅ **AI**: 自然言語で両方の機能を操作できる  
✅ **外部アプリ**: REST APIとして統合できる  

すべての機能が統一されたインターフェースで提供されます!

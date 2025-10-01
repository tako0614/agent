# Stripe決済統合ガイド

## Stripe決済機能

このプロジェクトにはStripeを使用した決済機能が統合されています。

### セットアップ

1. **Stripeアカウントの作成**
   - [Stripe Dashboard](https://dashboard.stripe.com/)にアクセス
   - アカウントを作成または既存のアカウントにログイン

2. **APIキーの取得**
   - Dashboard → Developers → API keys
   - Secret keyをコピー
   - Webhook signing secretも後で必要になります

3. **環境変数の設定**

   開発環境:
   ```powershell
   cd packages/agent
   ```
   
   `.dev.vars`ファイルに追加:
   ```
   STRIPE_SECRET_KEY=sk_test_your-secret-key
   STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
   ```

   本番環境:
   ```powershell
   wrangler secret put STRIPE_SECRET_KEY
   wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

4. **Webhookの設定**
   - Dashboard → Developers → Webhooks
   - "Add endpoint"をクリック
   - URLに`https://your-domain.com/api/webhooks/stripe`を設定
   - 以下のイベントを選択:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

### 決済フロー

#### 1. 単純な決済 (Payment Intent)

```typescript
POST /api/orders
Content-Type: application/json

{
  "productId": "prod_123",
  "quantity": 2,
  "userId": "user_456"
}
```

レスポンス:
```json
{
  "id": "ord_1234567890",
  "orderNumber": "ORD-1234567890",
  "status": "PENDING",
  "amount": 2000,
  "paymentIntentId": "pi_xxxxx",
  "clientSecret": "pi_xxxxx_secret_xxxxx",
  "productId": "prod_123",
  "quantity": 2,
  "userId": "user_456"
}
```

フロントエンドでの処理:
```typescript
// Stripe.jsをロード
const stripe = await loadStripe('pk_test_your_publishable_key');

// 注文を作成
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'prod_123',
    quantity: 2,
    userId: 'user_456'
  })
});

const order = await response.json();

// 決済を確認
const result = await stripe.confirmPayment({
  clientSecret: order.clientSecret,
  confirmParams: {
    return_url: 'https://your-domain.com/order/success',
  },
});
```

#### 2. Checkout Session

```typescript
POST /api/checkout/session
Content-Type: application/json

{
  "items": [
    {
      "productId": "prod_123",
      "name": "商品A",
      "description": "説明文",
      "price": 1000,
      "quantity": 2
    }
  ],
  "successUrl": "https://your-domain.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://your-domain.com/cancel"
}
```

レスポンス:
```json
{
  "sessionId": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxxxx"
}
```

フロントエンドでの処理:
```typescript
// セッションを作成
const response = await fetch('/api/checkout/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [
      {
        productId: 'prod_123',
        name: '商品A',
        price: 1000,
        quantity: 2
      }
    ],
    successUrl: window.location.origin + '/success',
    cancelUrl: window.location.origin + '/cancel'
  })
});

const session = await response.json();

// Stripeのチェックアウトページにリダイレクト
window.location.href = session.url;
```

#### 3. セッション情報の取得

```typescript
GET /api/checkout/session/:id
```

レスポンス:
```json
{
  "id": "cs_test_xxxxx",
  "status": "complete",
  "paymentStatus": "paid",
  "customerEmail": "customer@example.com",
  "amountTotal": 2000
}
```

### Webhook処理

Stripeからのイベントは自動的に処理されます:

```typescript
POST /api/webhooks/stripe
Stripe-Signature: t=xxxxx,v1=xxxxx
```

処理されるイベント:
- `payment_intent.succeeded`: 決済成功時
- `payment_intent.payment_failed`: 決済失敗時
- `checkout.session.completed`: チェックアウト完了時
- `customer.subscription.*`: サブスクリプションイベント

### PaymentServiceクラス

直接PaymentServiceを使用することもできます:

```typescript
import { createPaymentService } from './payment';

const paymentService = createPaymentService(STRIPE_SECRET_KEY);

// 顧客を作成
const customer = await paymentService.createCustomer({
  email: 'customer@example.com',
  name: 'John Doe',
  metadata: { userId: 'user_123' }
});

// 商品を作成
const product = await paymentService.createProduct({
  name: '商品名',
  description: '商品の説明',
  images: ['https://example.com/image.jpg']
});

// 価格を作成
const price = await paymentService.createPrice({
  product: product.id,
  unit_amount: 1000,
  currency: 'jpy'
});

// サブスクリプションを作成
const subscription = await paymentService.createSubscription({
  customer: customer.id,
  items: [{ price: price.id }],
  metadata: { planType: 'premium' }
});

// 返金処理
const refund = await paymentService.createRefund({
  payment_intent: 'pi_xxxxx',
  amount: 500,
  reason: 'requested_by_customer'
});
```

### テスト用カード番号

開発環境では以下のテストカード番号を使用できます:

- **成功**: `4242 4242 4242 4242`
- **失敗 (資金不足)**: `4000 0000 0000 9995`
- **失敗 (カード拒否)**: `4000 0000 0000 0002`
- **3Dセキュア認証必須**: `4000 0027 6000 3184`

有効期限: 任意の未来の日付  
CVC: 任意の3桁  
郵便番号: 任意

### セキュリティ

1. **APIキーの管理**
   - Secret keyは絶対にフロントエンドに公開しない
   - 本番環境では必ずsecretsを使用

2. **Webhook署名検証**
   - 全てのWebhookリクエストは署名が検証されます
   - 偽造されたリクエストは自動的に拒否されます

3. **金額の検証**
   - 決済金額は常にサーバーサイドで計算
   - クライアントから送信された金額は信頼しない

### エラーハンドリング

```typescript
try {
  const paymentIntent = await paymentService.createPaymentIntent({
    amount: 1000,
    currency: 'jpy'
  });
} catch (error) {
  if (error.type === 'StripeCardError') {
    // カードエラー
    console.error('Card error:', error.message);
  } else if (error.type === 'StripeInvalidRequestError') {
    // 無効なリクエスト
    console.error('Invalid request:', error.message);
  } else {
    // その他のエラー
    console.error('Error:', error.message);
  }
}
```

### サブスクリプション管理

```typescript
// サブスクリプションの作成
const subscription = await paymentService.createSubscription({
  customer: 'cus_xxxxx',
  items: [{ price: 'price_xxxxx' }],
  metadata: { planType: 'premium' }
});

// サブスクリプションのキャンセル
await paymentService.cancelSubscription(subscription.id);
```

### 次のステップ

- [ ] フロントエンドに決済UIを実装
- [ ] 注文履歴画面の実装
- [ ] サブスクリプション管理画面
- [ ] 請求書機能
- [ ] カスタマーポータル

### 参考リンク

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe.js Reference](https://stripe.com/docs/js)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Webhooks](https://stripe.com/docs/webhooks)
- [Testing](https://stripe.com/docs/testing)

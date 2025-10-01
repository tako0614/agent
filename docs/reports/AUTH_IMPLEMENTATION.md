# OAuth認証実装完了報告

## 実装内容

GoogleとLINEのOAuth認証機能を実装しました。

## 追加されたファイル

### バックエンド

1. **`worker/auth/index.ts`** - 認証サービス
   - GoogleとLINEのOAuthプロバイダー実装
   - ユーザー情報の取得
   - セッショントークンの生成と検証
   - PKCE (Proof Key for Code Exchange) サポート

2. **`worker/api/auth.ts`** - 認証APIエンドポイント
   - `GET /auth/login/google` - Googleログイン開始
   - `GET /auth/login/line` - LINEログイン開始
   - `GET /auth/callback/google` - Googleコールバック
   - `GET /auth/callback/line` - LINEコールバック
   - `GET /auth/me` - 現在のユーザー情報取得
   - `GET /auth/status` - 認証状態確認
   - `POST /auth/logout` - ログアウト

### フロントエンド

1. **`src/utils/auth.tsx`** - 認証コンテキスト
   - `AuthProvider` - 認証状態管理
   - `useAuth` - 認証フック

2. **`src/components/LoginButton.tsx`** - ログインボタン
   - Google/LINEのログインボタンUI

3. **`src/components/UserProfile.tsx`** - ユーザープロフィール
   - ユーザー情報表示
   - ログアウトボタン

### ドキュメント

1. **`docs/guides/AUTH_INTEGRATION.md`** - 認証システムの詳細ドキュメント
   - OAuth設定手順
   - 認証フローの説明
   - フロントエンド統合方法
   - セキュリティベストプラクティス

## 設定が必要な環境変数

`.dev.vars`ファイルに以下を追加してください:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback/google

# LINE Login
LINE_CLIENT_ID=your-line-channel-id
LINE_CLIENT_SECRET=your-line-channel-secret
LINE_REDIRECT_URI=http://localhost:8787/auth/callback/line

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

## OAuth設定手順

### Google

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. 「APIとサービス」→「認証情報」→「OAuthクライアントID」を作成
3. リダイレクトURIに`http://localhost:8787/auth/callback/google`を追加
4. クライアントIDとシークレットを環境変数に設定

### LINE

1. [LINE Developers Console](https://developers.line.biz/console/)でチャネルを作成
2. LINE Loginチャネルを選択
3. コールバックURLに`http://localhost:8787/auth/callback/line`を追加
4. Channel IDとChannel Secretを環境変数に設定

## 使用方法

### 開発サーバーの起動

```bash
# Workerの起動
cd packages/agent
npm run dev

# フロントエンドの起動(別のターミナル)
npm run dev:frontend
```

### ログインフロー

1. アプリケーションにアクセス(`http://localhost:5173`)
2. ログイン画面が表示される
3. 「Googleでログイン」または「LINEでログイン」をクリック
4. OAuth認証画面で承認
5. アプリケーションにリダイレクトされログイン完了

## セキュリティ機能

- **CSRF保護**: Stateパラメータで全てのOAuthフローを保護
- **PKCE**: Code Verifierを使用して認証コード傍受を防止
- **HttpOnly Cookie**: XSS攻撃からセッショントークンを保護
- **Secure Cookie**: HTTPS通信のみでCookieを送信
- **SameSite=Lax**: CSRF攻撃を防止

## 次のステップ

### データベース統合

現在、ユーザー情報はメモリに保存されています。Prismaを使ってデータベースに保存するには:

1. `prisma/schema.prisma`にUserモデルを追加:

```prisma
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  picture    String?
  provider   String   // 'google' or 'line'
  providerId String   // OAuth provider's user ID
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  conversations Conversation[]
  orders        Order[]
  bookings      Booking[]
  
  @@unique([provider, providerId])
}
```

2. `worker/api/auth.ts`のコールバックハンドラーを更新:

```typescript
// Uncomment and implement database integration
const user = await prisma.user.upsert({
  where: { 
    provider_providerId: {
      provider: 'google',
      providerId: userInfo.id
    }
  },
  create: {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    provider: 'google',
    providerId: userInfo.id
  },
  update: {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture
  }
});
```

### API保護

認証が必要なエンドポイントにミドルウェアを追加:

```typescript
import { getCookie } from 'hono/cookie';
import { createAuthService } from '../auth';

async function requireAuth(c: Context, next: Next) {
  const sessionToken = getCookie(c, 'session');
  
  if (!sessionToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const authService = createAuthService({});
  const session = authService.validateSessionToken(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  c.set('userId', session.userId);
  await next();
}

// Use in routes
app.post('/api/orders', requireAuth, async (c) => {
  const userId = c.get('userId');
  // Create order for authenticated user
});
```

## トラブルシューティング

### Cookieが保存されない

CORS設定を確認してください:

```typescript
// worker/index.ts
app.use('/*', cors({
  origin: 'http://localhost:5173', // 特定のオリジンを指定
  credentials: true
}));
```

フロントエンドでも`credentials: 'include'`を指定:

```typescript
fetch('/auth/status', {
  credentials: 'include'
});
```

### リダイレクトURIエラー

OAuthプロバイダーのコンソールで設定したリダイレクトURIと、環境変数の値が完全に一致していることを確認してください。

## 参考資料

- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) - 詳細な統合ガイド
- [Arctic Documentation](https://arctic.js.org/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [LINE Login Documentation](https://developers.line.biz/ja/docs/line-login/)

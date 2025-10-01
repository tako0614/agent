# 認証システム統合ガイド

このドキュメントでは、AI Service BuilderのOAuth認証システム(AIサービス側)の設定と使用方法について説明します。

## 概要

AIサービスは、以下のOAuthプロバイダーをサポートしています:

- **Google OAuth 2.0** - Googleアカウントでのログイン
- **LINE Login** - LINEアカウントでのログイン

認証システムは[Arctic](https://arctic.js.org/)ライブラリを使用して実装されており、Cloudflare Workers環境で動作します。

**重要**: この認証システムは**AIサービス側のユーザー認証**のみを扱います。MCPサーバーは別の認証システムを持ちます。詳細は[MCP_AUTH.md](./MCP_AUTH.md)を参照してください。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  フロントエンド                                           │
│  - LoginButton (Google/LINE)                            │
│  - UserProfile                                          │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  AIサービス Workers                                      │
│  - /auth/login/google                                   │
│  - /auth/login/line                                     │
│  - /auth/callback/google                                │
│  - /auth/callback/line                                  │
│  - セッション管理                                         │
│  - MCPアクセストークン発行                                │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ├─→ PostgreSQL (ユーザー情報保存)
                    │
                    └─→ MCPサーバー (トークン付きリクエスト)
```

## セットアップ

### 1. Google OAuth設定

#### Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「認証情報を作成」→「OAuthクライアントID」を選択
5. アプリケーションの種類で「ウェブアプリケーション」を選択
6. 承認済みのリダイレクトURIに以下を追加:
   - 開発環境: `http://localhost:8787/auth/callback/google`
   - 本番環境: `https://your-domain.com/auth/callback/google`
7. クライアントIDとクライアントシークレットをコピー

#### OAuth同意画面の設定

1. 「APIとサービス」→「OAuth同意画面」に移動
2. ユーザータイプを選択(外部を推奨)
3. アプリ情報を入力:
   - アプリ名
   - ユーザーサポートメール
   - デベロッパーの連絡先情報
4. スコープを追加:
   - `openid`
   - `email`
   - `profile`

### 2. LINE Login設定

#### LINE Developers Consoleでの設定

1. [LINE Developers Console](https://developers.line.biz/console/)にアクセス
2. プロバイダーを作成(既存のものを使用も可)
3. 新しいチャネルを作成し、「LINE Login」を選択
4. チャネル基本設定で以下を設定:
   - チャネル名
   - チャネル説明
   - アプリタイプ: ウェブアプリ
5. LINE LoginタブでコールバックURLを追加:
   - 開発環境: `http://localhost:8787/auth/callback/line`
   - 本番環境: `https://your-domain.com/auth/callback/line`
6. Channel IDとChannel Secretをコピー
7. スコープ設定で以下を有効化:
   - `profile`
   - `openid`
   - `email`(オプション)

### 3. 環境変数設定

`.dev.vars`ファイルに以下の環境変数を追加:

```bash
# AIサービスのGoogle OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback/google

# AIサービスのLINE Login
LINE_CLIENT_ID=your-line-channel-id
LINE_CLIENT_SECRET=your-line-channel-secret
LINE_REDIRECT_URI=http://localhost:8787/auth/callback/line

# MCPトークン用鍵ペア(AIサービスがMCPアクセストークンを発行するため)
MCP_TOKEN_PRIVATE_KEY=your-private-key-for-signing
MCP_TOKEN_PUBLIC_KEY=your-public-key-for-verification

# MCPサーバーURL
MCP_SERVER_URL=http://localhost:8788

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

本番環境では、Cloudflare Workersのシークレット機能を使用:

```bash
# Cloudflare Workers シークレットを設定
cd packages/agent
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put LINE_CLIENT_SECRET
wrangler secret put MCP_TOKEN_PRIVATE_KEY
```

**注意**: MCPサーバーとAIサービスの鍵ペアは共有されます:
- AIサービス: `MCP_TOKEN_PRIVATE_KEY`で署名
- MCPサーバー: `AI_SERVICE_PUBLIC_KEY`で検証

## 認証フロー

### 1. ログインの開始

ユーザーがログインボタンをクリックすると、以下のエンドポイントにリダイレクト:

**Google Login:**
```
GET /auth/login/google
```

**LINE Login:**
```
GET /auth/login/line
```

### 2. OAuth認証

1. ユーザーがOAuthプロバイダーのログインページにリダイレクト
2. ユーザーが認証を許可
3. OAuthプロバイダーがコールバックURLにリダイレクト

### 3. コールバック処理

**Google Callback:**
```
GET /auth/callback/google?code=xxx&state=xxx
```

**LINE Callback:**
```
GET /auth/callback/line?code=xxx&state=xxx
```

システムが以下を実行:
1. stateパラメータの検証(CSRF保護)
2. 認証コードの検証
3. ユーザー情報の取得
4. データベースにユーザーを作成/更新
5. セッショントークンの生成
6. セッションCookieの設定
7. フロントエンドにリダイレクト

### 4. セッション管理

認証後、セッションCookieが設定されます:

- **名前:** `session`
- **有効期限:** 7日間
- **属性:** HttpOnly, Secure, SameSite=Lax

## API エンドポイント

### 認証状態の確認

```http
GET /auth/status
```

**レスポンス:**
```json
{
  "authenticated": true,
  "userId": "google_123456789"
}
```

### 現在のユーザー情報取得

```http
GET /auth/me
```

**レスポンス:**
```json
{
  "userId": "google_123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "provider": "google"
}
```

### ログアウト

```http
POST /auth/logout
```

**レスポンス:**
```json
{
  "success": true
}
```

## フロントエンド統合

### SolidJSでの実装例

#### 1. 認証コンテキストの作成

```typescript
import { createContext, useContext, createSignal, onMount } from 'solid-js';

type User = {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'line';
};

type AuthContextType = {
  user: () => User | null;
  isAuthenticated: () => boolean;
  login: (provider: 'google' | 'line') => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: any }) {
  const [user, setUser] = createSignal<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);

  onMount(async () => {
    // Check authentication status
    try {
      const response = await fetch('/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        // Get user info
        const userResponse = await fetch('/auth/me', {
          credentials: 'include'
        });
        const userData = await userResponse.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  });

  const login = (provider: 'google' | 'line') => {
    window.location.href = `/auth/login/${provider}`;
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### 2. ログインボタンの実装

```typescript
import { useAuth } from './AuthContext';

export function LoginButton() {
  const { login } = useAuth();

  return (
    <div>
      <button onClick={() => login('google')}>
        Googleでログイン
      </button>
      <button onClick={() => login('line')}>
        LINEでログイン
      </button>
    </div>
  );
}
```

#### 3. ユーザー情報の表示

```typescript
import { Show } from 'solid-js';
import { useAuth } from './AuthContext';

export function UserProfile() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <Show
      when={isAuthenticated()}
      fallback={<LoginButton />}
    >
      <div>
        <img src={user()?.picture} alt={user()?.name} />
        <p>{user()?.name}</p>
        <p>{user()?.email}</p>
        <button onClick={logout}>ログアウト</button>
      </div>
    </Show>
  );
}
```

#### 4. 保護されたルートの実装

```typescript
import { Show } from 'solid-js';
import { useAuth } from './AuthContext';

export function ProtectedRoute(props: { children: any }) {
  const { isAuthenticated } = useAuth();

  return (
    <Show
      when={isAuthenticated()}
      fallback={<LoginButton />}
    >
      {props.children}
    </Show>
  );
}
```

## データベース統合

### Prismaスキーマの更新

ユーザーテーブルにOAuth情報を追加:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  picture   String?
  provider  String   // 'google' or 'line'
  providerId String  // OAuth provider's user ID
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  conversations Conversation[]
  orders        Order[]
  bookings      Booking[]
  
  @@unique([provider, providerId])
}
```

### コールバックでのユーザー作成/更新

`worker/api/auth.ts`のコールバックハンドラーで、データベースにユーザーを保存:

```typescript
// Google callback内
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

// Create session with database user ID
const sessionToken = authService.createSessionToken(user.id);
```

## セキュリティのベストプラクティス

### 1. CSRF保護

- Stateパラメータで全てのOAuthフローを保護
- StateをHTTPOnly Cookieに保存
- コールバックでStateを検証

### 2. PKCE (Proof Key for Code Exchange)

- Code Verifierを生成してCookieに保存
- OAuth認証フローで使用
- 認証コード傍受攻撃を防止

### 3. セッション管理

- HttpOnly Cookieでセッショントークンを保存(XSS保護)
- Secure属性を有効化(HTTPS通信のみ)
- SameSite=LaxでCSRF攻撃を防止
- 適切な有効期限を設定(7日間推奨)

### 4. シークレットの管理

- 環境変数を`.gitignore`に追加
- 本番環境ではCloudflare Workers Secretsを使用
- シークレットをコードにハードコーディングしない

## トラブルシューティング

### よくある問題

#### 1. リダイレクトURIの不一致

**エラー:** `redirect_uri_mismatch`

**解決方法:**
- OAuthプロバイダーのコンソールで設定したリダイレクトURIが、アプリケーションで使用しているものと完全に一致していることを確認
- プロトコル(http/https)、ポート番号、パスまで正確に一致させる

#### 2. 無効なスコープ

**エラー:** `invalid_scope`

**解決方法:**
- リクエストしているスコープがOAuthプロバイダーでサポートされていることを確認
- スコープがコンソールで有効化されていることを確認

#### 3. Cookieが保存されない

**原因:** CORS設定やSecure属性の問題

**解決方法:**
```typescript
// CORS設定でcredentialsを有効化
app.use('/*', cors({
  origin: 'http://localhost:5173', // 特定のオリジンを指定
  credentials: true
}));

// フロントエンドのfetchでcredentials: 'include'を指定
fetch('/auth/status', {
  credentials: 'include'
});
```

#### 4. セッションが期限切れ

**解決方法:**
- セッショントークンの検証ロジックを確認
- 期限切れの場合は自動的に再ログインを促す

## 次のステップ

1. **多要素認証(MFA)** - 追加のセキュリティレイヤー
2. **ソーシャルログインの追加** - GitHub, Twitterなど
3. **リフレッシュトークン** - 長期間のセッション維持
4. **メール認証** - パスワードベースの認証を追加

## 参考リンク

- [Arctic Documentation](https://arctic.js.org/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [LINE Login Documentation](https://developers.line.biz/ja/docs/line-login/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

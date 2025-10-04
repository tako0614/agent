# Googleログイン機能の実装完了

## 実装内容

Googleアカウントでログインできる機能を実装しました。

### 追加された機能

1. **Google OAuth 2.0 認証フロー**
   - `/auth/google` - Googleログインを開始するエンドポイント
   - `/auth/callback/google` - Googleからのコールバックを処理するエンドポイント

2. **ユーザー管理**
   - 初回ログイン時に自動的にユーザーアカウントを作成
   - GoogleアカウントとリンクしてOAuthAccountテーブルに保存
   - JWT形式のアクセストークンを発行

3. **フロントエンド**
   - ログイン画面にGoogleログインボタンを追加
   - ログイン後、トークンをlocalStorageに保存
   - 全てのAPIリクエストにAuthorizationヘッダーを付与

## 使い方

### 1. 開発サーバーを起動

```powershell
npm run dev:agent
```

サーバーは `http://127.0.0.1:8787` で起動します。

### 2. ブラウザでアクセス

1. `http://127.0.0.1:8787` にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Googleアカウントでログイン
4. 認証が完了すると自動的にアプリケーションにリダイレクトされます

### 3. ログイン後

- ログイン後はチャットUIが表示されます
- ユーザー情報は`/api/user/me`エンドポイントで取得できます
- JWTトークンはlocalStorageに保存され、自動的に各APIリクエストに付与されます

## Google OAuth設定

`.dev.vars`ファイルに以下の設定が必要です（既に設定済み）:

```env
GOOGLE_CLIENT_ID=809769910884-4dkujbe9q8mi8824t3gh5guo1ujhr8n8.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/auth/callback/google
JWT_SECRET=your-very-secret-jwt-key-change-this-in-production
MCP_ISSUER=http://127.0.0.1:8787
```

## 技術スタック

- **OAuth 2.1**: Arcticライブラリを使用
- **JWT**: jose ライブラリでトークン生成・検証
- **Database**: D1 (SQLite) でユーザー情報を保存
- **Frontend**: SolidJS

## データベーステーブル

### User
- `id`: ユーザーID (CUID)
- `email`: メールアドレス
- `displayName`: 表示名
- `createdAt`, `updatedAt`: タイムスタンプ

### OAuthAccount
- `id`: アカウントID (CUID)
- `userId`: ユーザーID
- `provider`: プロバイダー名 (google)
- `providerAccountId`: GoogleのユーザーID
- `accessToken`: Googleのアクセストークン
- `refreshToken`: Googleのリフレッシュトークン
- `expiresAt`: トークンの有効期限

## トラブルシューティング

### ログインできない場合

1. `.dev.vars`ファイルが正しく設定されているか確認
2. Google Cloud Consoleで認証情報が有効か確認
3. リダイレクトURIが `http://127.0.0.1:8787/auth/callback/google` に設定されているか確認

### トークンが保存されない場合

1. ブラウザのlocalStorageを確認 (Developer Tools > Application > Local Storage)
2. `auth_token`キーが存在するか確認
3. ブラウザのCookieが有効になっているか確認

## 今後の拡張予定

- [ ] LINE Loginの実装
- [ ] トークンのリフレッシュ機能
- [ ] ログアウト機能
- [ ] プロフィール編集機能

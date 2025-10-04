# Agent クライアント実装ガイド

## 概要

このクライアントは `docs/specs/DETAILED_SPEC.md` に基づいて実装された AI Agent の SolidJS フロントエンドです。OAuth 2.1 PKCE フローによる認証と、MCP サーバーとの連携機能を提供します。

## 実装内容

### 1. 型定義 (`src/types/api.ts`)

DETAILED_SPEC.md のデータモデルと API 仕様に基づく TypeScript 型定義:
- `User`, `McpServer`, `AgentMcpLink` などのモデル型
- API リクエスト/レスポンス型
- 列挙型 (`McpStatus`, `McpAuthType`)

### 2. API クライアント (`src/lib/api-client.ts`)

`packages/agent/worker/index.ts` の API エンドポイントに対応:

#### User API
- `getMe()` - 現在のユーザー取得 (`GET /api/user/me`)

#### MCP API
- `getLinkedMcps()` - ユーザーに紐づく MCP 一覧 (`GET /api/mcp/linked`)
- `searchMcps()` - MCP 検索 (`POST /api/mcp/search`)
- `linkMcp()` - MCP 追加 (`POST /api/mcp/link`)
- `unlinkMcp()` - MCP 削除 (`POST /api/mcp/unlink`)
- `testMcp()` - 接続テスト (`POST /api/mcp/test`)

#### Agent API
- `sendChat()` - LangGraph 実行 (`POST /api/agent/chat`)
- `getSessionState()` - セッション状態取得 (`GET /api/agent/state/:sessionId`)
- `interruptSession()` - 実行中断 (`POST /api/agent/interrupt`)

### 3. OAuth 2.1 PKCE (`src/lib/oauth.ts`)

DETAILED_SPEC.md セクション 4 の OAuth 2.1 要件に準拠:

- **PKCE 必須**: S256 チャレンジメソッドを使用
- **状態管理**: `sessionStorage` で state と code_verifier を管理
- **セキュリティ**: CSRF 攻撃対策の state パラメータ検証

#### 主要クラス
- `OAuthManager.startAuthFlow()` - 認可フロー開始
- `OAuthManager.handleCallback()` - リダイレクト後のコールバック処理
- `generatePKCE()` - code_verifier と code_challenge の生成

### 4. UI コンポーネント

#### `MessageItem.tsx`
チャットメッセージの表示コンポーネント:
- ユーザー/アシスタントのメッセージを区別
- メタデータの折りたたみ表示

#### `McpList.tsx`
登録済み MCP サーバーの一覧表示:
- 有効/無効状態の表示
- テスト・削除ボタン
- サーバーステータス表示

#### `McpSearch.tsx`
MCP サーバーの検索・追加コンポーネント:
- 検索機能
- 検索結果の表示
- ワンクリックで MCP を追加

#### `Auth.tsx`
OAuth 認証関連コンポーネント:
- `LoginButton` - ログインボタン
- `AuthCallback` - OAuth コールバック処理

### 5. メインアプリ (`src/App.tsx`)

DETAILED_SPEC.md の仕様に基づくメイン UI:

#### 機能
- **認証状態管理**: ユーザー情報の取得と表示
- **チャット UI**: メッセージ送受信とセッション管理
- **MCP 管理**: サーバーの検索・追加・削除・テスト
- **ビュー切替**: チャットと MCP 管理の切り替え

#### レイアウト
- サイドバー: ユーザー情報、セッション情報、MCP カウント
- メインエリア: チャットまたは MCP 管理画面
- 入力エリア: メッセージ入力フォーム

## 環境変数

`.env` ファイルに以下の環境変数を設定してください:

```env
# OAuth 設定 (packages/mcp-server を指す)
VITE_OAUTH_AUTH_ENDPOINT=http://localhost:8788/auth/authorize
VITE_OAUTH_TOKEN_ENDPOINT=http://localhost:8788/auth/token
VITE_OAUTH_CLIENT_ID=agent-client
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# API 設定 (オプション: デフォルトは /api)
VITE_API_BASE_URL=/api
```

## 開発ワークフロー

### 1. 依存関係のインストール
```powershell
npm install
```

### 2. データベース準備
```powershell
# packages/database でPrismaクライアント生成
npm run db:generate

# マイグレーション適用
npm run db:migrate --workspace=packages/database
```

### 3. MCP サーバー起動
```powershell
# 別ターミナルで
npm run dev:mcp
```

### 4. Agent アプリ起動
```powershell
npm run dev:agent
```

ブラウザで `http://localhost:3000` にアクセス

## API エンドポイント対応表

| UI 機能 | API エンドポイント | DETAILED_SPEC 参照 |
|---------|-------------------|-------------------|
| ユーザー情報取得 | `GET /api/user/me` | セクション 3.2 |
| MCP 一覧 | `GET /api/mcp/linked` | セクション 3.2 |
| MCP 検索 | `POST /api/mcp/search` | セクション 3.2 |
| MCP 追加 | `POST /api/mcp/link` | セクション 3.2 |
| MCP 削除 | `POST /api/mcp/unlink` | セクション 3.2 |
| MCP テスト | `POST /api/mcp/test` | セクション 3.2 |
| チャット送信 | `POST /api/agent/chat` | セクション 3.2, 6.1 |
| セッション取得 | `GET /api/agent/state/:sessionId` | セクション 3.2 |

## 今後の拡張

### 実装予定機能
1. **SSE ストリーミング**: `AgentChatRequest.stream = true` 時のリアルタイム応答
2. **OAuth ログアウト**: トークン無効化とセッションクリア
3. **エラーハンドリング**: より詳細なエラー表示とリトライ機能
4. **MCP 設定**: `configJson` の UI 編集機能
5. **セッション履歴**: 過去のセッション一覧と復元

### セキュリティ強化
- トークンの安全な保存 (HttpOnly Cookie 推奨)
- XSS 対策の強化
- CORS 設定の厳格化 (`ALLOWED_ORIGINS`)

## トラブルシューティング

### 認証エラー
- MCP サーバー (`packages/mcp-server`) が起動しているか確認
- `.dev.vars` に必要な環境変数が設定されているか確認
- `wrangler.toml` の `run_worker_first` 設定を確認

### API エラー
- Worker のログを確認: `wrangler tail`
- CORS エラー: Hono ミドルウェアの設定を確認

### ビルドエラー
- TypeScript エラー: `npm run db:generate` を実行
- 依存関係エラー: `npm install` を再実行
- キャッシュクリア: `rm -rf node_modules/.vite`

## 参考資料

- [DETAILED_SPEC.md](../../docs/specs/DETAILED_SPEC.md) - 詳細仕様
- [packages/agent/README.md](./README.md) - Agent パッケージ概要
- [OAuth 2.1 仕様](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [SolidJS ドキュメント](https://www.solidjs.com/docs/latest)

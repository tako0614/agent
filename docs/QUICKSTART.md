# クイックスタートガイド

## 1. データベースのセットアップ

### PostgreSQLデータベースの準備

```powershell
# PostgreSQLを起動(ローカル環境の場合)
# または、リモートデータベースの接続情報を用意
```

### 環境変数の設定

`packages/database/.env`ファイルを作成:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/agent_db"
```

### マイグレーションの実行

```powershell
# ルートディレクトリで実行
npm run db:generate
npm run db:push
npm run db:seed
```

## 2. 開発サーバーの起動

```powershell
# ルートディレクトリで実行
npm run dev
```

または

```powershell
# 個別に起動
cd packages/agent
npm run build
wrangler dev
```

## 3. ブラウザでアクセス

開発サーバーが起動したら、以下のURLにアクセス:

- **アプリケーション**: http://localhost:8787
- **API**: http://localhost:8787/api
- **MCP Tools**: http://localhost:8787/mcp/tools

## 4. 基本的な使い方

### チャットUIでの操作

1. ブラウザでアプリを開く
2. チャット入力欄にメッセージを入力
3. Enterキーで送信(Shift+Enterで改行)
4. AIエージェントからの応答を待つ

### APIの直接呼び出し

```powershell
# ヘルスチェック
curl http://localhost:8787/api/health

# サービス一覧取得
curl http://localhost:8787/api/services

# 利用可能なツール一覧
curl http://localhost:8787/mcp/tools
```

## 5. データベースの管理

```powershell
# Prisma Studioを起動
npm run db:studio
```

ブラウザで http://localhost:5555 にアクセスして、データベースのデータを視覚的に管理できます。

## 6. 本番環境へのデプロイ

```powershell
# ビルド
npm run build

# Cloudflare Workersにデプロイ
cd packages/agent
wrangler deploy
```

デプロイ前に`wrangler.toml`で本番環境の設定を行ってください。

## トラブルシューティング

### データベース接続エラー

- `DATABASE_URL`が正しく設定されているか確認
- PostgreSQLが起動しているか確認
- ネットワーク接続を確認

### ビルドエラー

```powershell
# node_modulesを削除して再インストール
Remove-Item -Recurse -Force node_modules
npm install
```

### Prismaクライアントのエラー

```powershell
# Prismaクライアントを再生成
npm run db:generate
```

## 次のステップ

- `packages/agent/src/App.tsx`を編集してUIをカスタマイズ
- `packages/agent/worker/api/index.ts`を編集してAPIを追加
- `packages/database/prisma/schema.prisma`を編集してデータモデルを拡張
- OpenAI APIキーを設定してAI機能を有効化(実装予定)

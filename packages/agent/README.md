# Agent App

Vite + SolidJS + Cloudflare Workers + Honoの最小構成

## 開発環境のセットアップ

### 依存関係のインストール
```bash
npm install
```

### 開発サーバーの起動

1. Cloudflare Workersサーバーを起動:
```bash
npm run dev:worker
```

2. 別のターミナルでフロントエンドサーバーを起動:
```bash
npm run dev
```

フロントエンドは `http://localhost:3000` で、APIは `http://localhost:8787` で起動します。

### ビルド
```bash
npm run build
```

## API エンドポイント

- `GET /api/hello` - Hello Worldメッセージ
- `GET /api/status` - アプリケーションステータス

## 技術スタック

- **Frontend**: Vite + SolidJS
- **Backend**: Cloudflare Workers + Hono
- **Language**: TypeScript

# @agent/database

統一データベースパッケージ - Prismaを使用したタイプセーフなデータベースアクセス

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
# .envファイルを編集してDATABASE_URLを設定
```

### 3. Prismaクライアントの生成
```bash
npm run db:generate
```

### 4. データベースの同期
```bash
# 開発環境の場合
npm run db:push

# または、マイグレーションを作成する場合
npm run db:migrate
```

### 5. シードデータの投入（オプション）
```bash
npm run db:seed
```

## 利用可能なスクリプト

- `npm run build` - TypeScriptをビルド
- `npm run dev` - ウォッチモードでビルド
- `npm run db:generate` - Prismaクライアントを生成
- `npm run db:push` - スキーマをデータベースにプッシュ
- `npm run db:migrate` - マイグレーションを作成・実行
- `npm run db:studio` - Prisma Studioを起動
- `npm run db:seed` - シードデータを投入

## 使用方法

```typescript
import { prisma, userService, agentService, taskService } from '@agent/database';

// ユーザーの作成
const user = await userService.create({
  email: 'user@example.com',
  name: 'User Name'
});

// エージェントの作成
const agent = await agentService.create({
  name: 'My Agent',
  description: 'A helpful agent',
  userId: user.id,
  config: {
    model: 'gpt-4',
    temperature: 0.7
  }
});

// タスクの作成
const task = await taskService.create({
  title: 'Complete project',
  description: 'Finish the implementation',
  priority: 'HIGH',
  userId: user.id,
  agentId: agent.id
});
```

## スキーマ構造

### テーブル
- **users** - ユーザー情報
- **agents** - AIエージェント設定
- **tasks** - タスク管理
- **logs** - システムログ

### リレーション
- User → Agent (1:N)
- User → Task (1:N)
- Agent → Task (1:N)

## 開発ガイドライン

1. スキーマを変更した場合は`npm run db:generate`を実行
2. 本番環境では`npm run db:migrate`を使用
3. 開発環境では`npm run db:push`を使用
4. 新しいサービス関数は`src/services.ts`に追加

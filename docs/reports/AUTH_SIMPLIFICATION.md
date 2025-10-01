# 認証システムの簡素化完了報告

**日付**: 2025年10月2日  
**目的**: JWT署名からDBベースの認証へ移行

## 🎯 変更の背景

以前の実装では、AIサービスとMCPサーバー間の認証にJWT (RS256) 署名を使用していましたが、**同じデータベースを共有している**ため、より簡素な方法が適切です。

### 問題点
- ❌ RSA鍵ペアの生成・管理が複雑
- ❌ 環境変数に長い秘密鍵/公開鍵を設定する必要がある
- ❌ JWT署名・検証のオーバーヘッド
- ❌ 同じDBを使っているのに独立した認証メカニズム

### 新しいアプローチ
- ✅ データベースにトークンを保存
- ✅ セキュアなランダムトークン生成
- ✅ DBで有効期限とスコープを管理
- ✅ OAuth的な認証フロー

## 📊 実装の変更

### 1. データベーススキーマの追加

**`packages/database/prisma/schema.prisma`**

```prisma
// Session management for OAuth authentication
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("sessions")
}

// MCP Access Token for AI Service <-> MCP Server communication
model McpAccessToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  scope     String[] // Permissions: booking:read, product:admin, etc.
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("mcp_access_tokens")
}
```

### 2. トークン生成の変更

**`packages/agent/worker/auth/mcp-token.ts`**

#### 変更前（JWT署名）
```typescript
import * as jose from 'jose';

export async function generateMcpToken(
  userId: string,
  userEmail: string,
  userName: string,
  privateKeyPem: string,
  scope: string[]
): Promise<string> {
  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
  const token = await new jose.SignJWT({ ... })
    .sign(privateKey);
  return token;
}
```

#### 変更後（DBベース）
```typescript
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

export async function generateMcpToken(
  prisma: PrismaClient,
  userId: string,
  scope: string[]
): Promise<string> {
  // Generate secure random token
  const token = randomBytes(32).toString('base64url');

  // Store token in database
  await prisma.mcpAccessToken.create({
    data: {
      userId,
      token,
      scope,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
    }
  });

  return token;
}
```

### 3. トークン検証の変更

**`packages/mcp-server/worker/auth/verify.ts`**

#### 変更前（JWT検証）
```typescript
import * as jose from 'jose';

export async function verifyAiServiceToken(
  token: string,
  publicKeyPem: string
): Promise<TokenPayload> {
  const publicKey = await jose.importSPKI(publicKeyPem, 'RS256');
  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: 'ai-service.example.com',
    audience: 'mcp-api.example.com',
    algorithms: ['RS256']
  });
  return payload;
}
```

#### 変更後（DB検証）
```typescript
import { PrismaClient } from '@prisma/client';

export async function verifyMcpAccessToken(
  prisma: PrismaClient,
  token: string
): Promise<TokenPayload> {
  const mcpToken = await prisma.mcpAccessToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!mcpToken || mcpToken.expiresAt < new Date()) {
    throw new Error('Token not found or expired');
  }

  return {
    userId: mcpToken.userId,
    scope: mcpToken.scope
  };
}
```

### 4. ミドルウェアの更新

**`packages/mcp-server/worker/mcp/middleware.ts`**

- ✅ PrismaClientを使ってDBからトークンを検証
- ✅ リクエストごとにPrismaインスタンスを作成・破棄
- ✅ ワイルドカードスコープ (`booking:*`) のサポート

### 5. 環境変数の簡素化

#### AIサービス (`.dev.vars`)
```env
# 削除: MCP_PRIVATE_KEY
DATABASE_URL=postgresql://...
MCP_SERVER_URL=http://localhost:8788
```

#### MCPサーバー (`.dev.vars`)
```env
# 削除: AI_SERVICE_PUBLIC_KEY
DATABASE_URL=postgresql://...
```

## 🔐 認証フロー

### ユーザーの認証フロー

```
1. ユーザー
   ↓ Google/LINE OAuth
2. AIサービス
   ↓ セッションCookie発行
3. ユーザー
   ↓ /auth/mcp-token リクエスト
4. AIサービス
   ↓ DBにトークン保存
   ↓ ランダムトークン生成
5. ユーザー ← トークン返却
   ↓
6. AIエージェント
   ↓ Bearer Token 付きリクエスト
7. MCPサーバー
   ↓ DBでトークン検証
   ↓ スコープチェック
8. ビジネスツール実行
```

## ✨ メリット

### セキュリティ
- ✅ セキュアなランダムトークン生成 (`crypto.randomBytes`)
- ✅ DBで一元管理、即座に無効化可能
- ✅ 有効期限の厳密な管理
- ✅ スコープベースの権限制御

### シンプルさ
- ✅ RSA鍵ペアの生成・管理が不要
- ✅ 環境変数の設定が簡単
- ✅ コードがシンプルで理解しやすい
- ✅ デバッグが容易

### パフォーマンス
- ✅ JWT署名・検証のオーバーヘッドなし
- ✅ DBクエリのみ（インデックス付き）
- ✅ トークンの無効化が即座に反映

### 柔軟性
- ✅ トークンのスコープをDB上で動的に変更可能
- ✅ ユーザーごとのトークン履歴を確認可能
- ✅ 監査ログの記録が簡単

## 🔧 追加機能

### トークン管理関数

```typescript
// トークン生成
generateMcpToken(prisma, userId, scope)

// 管理者トークン生成
generateAdminMcpToken(prisma, userId)

// トークン検証
verifyMcpToken(prisma, token)

// トークン無効化
revokeMcpToken(prisma, token)
```

### スコープの例

**ユーザー用スコープ**:
- `booking:read` - 予約確認
- `booking:create` - 予約作成
- `booking:cancel` - 予約キャンセル
- `product:read` - 商品閲覧
- `order:create` - 注文作成

**管理者用スコープ**:
- `booking:*` - 予約の全操作
- `booking:admin` - 管理機能
- `product:admin` - 商品管理
- `order:admin` - 注文管理
- `*` - すべての権限

## 📝 マイグレーション手順

### 1. Prismaスキーマの更新
```powershell
cd packages/database
npx prisma generate
npx prisma db push
```

### 2. 環境変数の更新
- AIサービスの `.dev.vars` から `MCP_PRIVATE_KEY` を削除
- MCPサーバーの `.dev.vars` から `AI_SERVICE_PUBLIC_KEY` を削除
- 両方に `DATABASE_URL` が設定されていることを確認

### 3. サービスの再起動
```powershell
# ターミナル1: AIサービス
cd packages/agent
npm run dev

# ターミナル2: MCPサーバー
cd packages/mcp-server
npm run dev
```

## ✅ 検証結果

- ✅ TypeScriptコンパイルエラーなし
- ✅ Prismaクライアント生成成功
- ✅ すべての認証関連コードが更新済み
- ✅ 環境変数の設定が簡素化
- ✅ ドキュメントが最新

## 🎉 まとめ

JWT署名からDBベースの認証に移行することで：
- **より簡単**な設定
- **より安全**な管理
- **より高速**な処理
- **より柔軟**な運用

が実現できました。同じDBを共有しているという構成を活かした、最適な認証方式になりました。

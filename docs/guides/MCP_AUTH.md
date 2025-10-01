# MCP認証システムの実装(分離アーキテクチャ)

## 概要

MCPサーバーは**独立したCloudflare Workersプロジェクト**として別ドメインに配置され、AIサービスとは分離された認証システムを持ちます。

認証方式は**DBベースのトークン管理**を採用しており、RSA鍵ペアやJWT署名は使用しません。

### アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────┐
│  AIサービス (ai-service.example.com)                      │
│  - Google/LINE OAuth認証                                  │
│  - ユーザーセッション管理                                  │
│  - MCPアクセストークン発行 (DB保存)                        │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTPリクエスト
                 │ Authorization: Bearer <random-token>
                 ▼
┌──────────────────────────────────────────────────────────┐
│  MCPサーバー (mcp-api.example.com)                        │
│  - トークン検証 (DB照合)                                   │
│  - 独自Google OAuth(開発者/管理者用)                       │
│  - MCP Tools提供                                          │
└──────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL Database (共有)                               │
│  - McpAccessToken テーブル                                │
│  - Session テーブル                                       │
│  - User テーブル                                          │
└──────────────────────────────────────────────────────────┘
```

## 認証方法

MCPサーバーは以下の**2つの独立した認証方式**をサポートします:

### 1. **AIサービストークン認証** (エンドユーザー向け)
   - AIサービスがユーザー認証後にトークンを発行しDBに保存
   - MCPサーバーがDBからトークンを検証
   - ユーザーはAIサービスのGoogle/LINE認証を利用
   - MCPサーバー側では直接認証しない

**フロー**:
```
User → AIサービス(Google/LINE認証) → DBにトークン保存
  → MCP APIリクエスト(トークン付き) → DB照合で検証 → アクセス許可
```

### 2. **MCP独自Google OAuth** (開発者/管理者向け)
   - MCPサーバー自身のGoogle OAuth認証
   - 開発者や管理者が直接MCPサーバーにアクセス
   - AIサービスを経由しない直接アクセス
   - 管理用APIやツール開発に使用

**フロー**:
```
Developer → MCP Google認証 → MCPセッション確立
  → MCP API直接アクセス → 管理機能利用
```

### 3. **公開アクセス** (認証不要)
   - 商品検索、フォーム表示など公開エンドポイント
   - 誰でもアクセス可能

## 実装されたファイル

### AIサービス側 (`packages/agent/worker/`)

#### 1. `worker/auth/mcp-token.ts` - MCPアクセストークン管理
```typescript
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// AIサービスがMCP用トークンを発行してDBに保存
export async function generateMcpToken(
  prisma: PrismaClient,
  userId: string,
  scope: string[] = ['booking:read', 'booking:create', 'product:read', 'order:create']
): Promise<string> {
  // セキュアなランダムトークン生成
  const token = randomBytes(32).toString('base64url');

  // DBに保存
  await prisma.mcpAccessToken.create({
    data: {
      userId,
      token,
      scope,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1時間
    }
  });

  return token;
}

// AIエージェントがMCP APIを呼び出す
export async function callMcpApi(
  endpoint: string,
  token: string,
  data: any
) {
  const response = await fetch(`https://mcp-api.example.com${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

#### 2. `worker/api/conversations.ts` - AI会話処理
```typescript
import { PrismaClient } from '@prisma/client';
import { generateMcpToken } from '../auth/mcp-token';

// AIがユーザーのリクエストを処理し、必要に応じてMCP APIを呼び出す
app.post('/api/conversations/:id/messages', async (c) => {
  const prisma = new PrismaClient({ datasources: { db: { url: c.env.DATABASE_URL } } });
  const userId = getCurrentUserId(c); // AIサービスのセッションから取得
  const message = await c.req.json();
  
  // MCP用トークンを生成（必要時）
  const mcpToken = await generateMcpToken(prisma, userId);
  
  // LangGraphでAI処理
  const result = await aiAgent.process(message.content, {
    userId,
    mcpToken // AIエージェントがこれを使ってMCP APIを呼び出す
  });
  
  await prisma.$disconnect();
  return c.json({ result });
});
```

### MCPサーバー側 (`packages/mcp-server/worker/`)

#### 1. `worker/auth/verify.ts` - トークン検証

```typescript
import { PrismaClient } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  scope: string[];
}

// DBからMCPアクセストークンを検証
export async function verifyMcpAccessToken(
  prisma: PrismaClient,
  token: string
): Promise<TokenPayload> {
  const mcpToken = await prisma.mcpAccessToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!mcpToken) {
    throw new Error('Token not found');
  }

  // 有効期限チェック
  if (mcpToken.expiresAt < new Date()) {
    await prisma.mcpAccessToken.delete({ where: { id: mcpToken.id } });
    throw new Error('Token expired');
  }

  return {
    userId: mcpToken.userId,
    scope: mcpToken.scope
  };
}

// スコープチェック
export function hasScope(requiredScope: string, userScopes: string[]): boolean {
  if (userScopes.includes(requiredScope)) return true;
  
  // ワイルドカード (例: "booking:*" が "booking:read" にマッチ)
  const [resource] = requiredScope.split(':');
  return userScopes.includes(`${resource}:*`) || userScopes.includes('*');
}
```

#### 2. `worker/mcp/middleware.ts` - 認証ミドルウェア

```typescript
import { PrismaClient } from '@prisma/client';
import { verifyMcpAccessToken } from '../auth/verify';

// ミドルウェアは統一的な認証チェックを実施
export function middleware(handler: any): any {
  const app = handler;

  app.use('/*', async (c: any, next: any) => {
    const databaseUrl = c.env.DATABASE_URL;
    if (!databaseUrl) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    // AIサービストークン検証
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = await verifyMcpAccessToken(prisma, token);
        
        const user = await prisma.user.findUnique({
          where: { id: payload.userId }
        });

        if (!user) {
          await prisma.$disconnect();
          return c.json({ error: 'User not found' }, 401);
        }
        
        c.set('auth', {
          type: 'mcp-token',
          userId: payload.userId,
          scope: payload.scope,
          user: { id: user.id, email: user.email, name: user.name || '' }
        });
        
        c.set('prisma', prisma);
        await next();
        await prisma.$disconnect();
        return;
      } catch (error) {
        await prisma.$disconnect();
        return c.json({ error: 'Invalid token' }, 401);
      }
    }

    // MCP管理者セッション検証
    const cookies = c.req.header('Cookie');
    const sessionCookie = cookies?.split(';').find((c: string) => c.trim().startsWith('mcp_session='));
    
    if (sessionCookie) {
      try {
        const sessionToken = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(atob(sessionToken));
        
        c.set('auth', {
          type: 'mcp-admin',
          userId: sessionData.userId,
          scope: ['*'], // 管理者は全権限
          user: {
            id: sessionData.userId,
            email: sessionData.email,
            name: sessionData.name,
            role: sessionData.role
          }
        });
        
        c.set('prisma', prisma);
        await next();
        await prisma.$disconnect();
        return;
      } catch (error) {
        await prisma.$disconnect();
        return c.json({ error: 'Invalid session' }, 401);
      }
    }

    await prisma.$disconnect();
    return c.json({ error: 'Authentication required' }, 401);
  });

  return app;
}
```

```typescript
// MCP管理者/開発者用Google OAuth
app.get('/auth/login/google', async (c) => {
  const google = new Google(
    c.env.MCP_GOOGLE_CLIENT_ID,
    c.env.MCP_GOOGLE_CLIENT_SECRET,
    c.env.MCP_GOOGLE_REDIRECT_URI
  );
  
  const state = generateState();
  const url = await google.createAuthorizationURL(state, {
    scopes: ['openid', 'profile', 'email']
  });
  
  // stateをセッションに保存
  await saveState(c, state);
  
  return c.redirect(url.toString());
});

app.get('/auth/callback/google', async (c) => {
  // OAuth callback処理
  const { code, state } = c.req.query();
  
  // state検証
  const savedState = await getState(c);
  if (state !== savedState) {
    return c.json({ error: 'Invalid state' }, 400);
  }
  
  // トークン交換
  const tokens = await google.validateAuthorizationCode(code);
  const userInfo = await fetchGoogleUserInfo(tokens.accessToken);
  
  // MCP管理者としてユーザー作成/取得
  const mcpUser = await createOrGetMcpUser(userInfo);
  
  // MCPセッション作成
  const sessionId = await createMcpSession(mcpUser.id);
  
  // セッションCookie設定
  setCookie(c, 'mcp_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7 // 7日間
  });
  
  return c.redirect('/mcp/dashboard');
});
```

#### 3. `worker/mcp/tools/booking.ts` - MCP Toolsの実装例

```typescript
// 使い方
app.get('/mcp/tools/booking/available-slots', publicEndpoint, async (c) => {
  // 認証不要、誰でもアクセス可能
  const slots = await getAvailableSlots();
  return c.json({ success: true, data: slots });
});

app.post('/mcp/tools/booking/create', requireAuth, async (c) => {
  // AIサービストークンまたはMCPセッション認証が必要
  const userId = c.get('userId') || c.get('mcpUserId');
  const authType = c.get('authType');
  
  const booking = await c.req.json();
  const result = await createBooking({ ...booking, userId });
  
  return c.json({ success: true, data: result, authType });
});
```

## 使用例

### 1. エンドユーザーがAIサービス経由でMCPを利用

```javascript
// フロントエンド: AIサービスにログイン
// (Google/LINE OAuth経由でAIサービス認証)

// ユーザーがAIチャットで予約リクエスト
const response = await fetch('https://ai-service.example.com/api/conversations/123/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // AIサービスのセッションCookie
  body: JSON.stringify({
    content: '明日の10時に予約したいです'
  })
});

// バックエンド(AIサービス):
// 1. AIがユーザーの意図を理解
// 2. MCPアクセストークンを生成
// 3. MCP APIを呼び出し
const mcpToken = await generateMcpAccessToken(userId, ['booking:create']);

const mcpResponse = await fetch('https://mcp-api.example.com/mcp/tools/booking/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${mcpToken}`
  },
  body: JSON.stringify({
    serviceId: 'srv_123',
    date: '2025-10-03',
    time: '10:00',
    customerName: user.name,
    customerEmail: user.email
  })
});

// MCPサーバー:
// 1. AIサービストークンを検証
// 2. ユーザーIDを取得
// 3. 予約を作成
// 4. 結果を返す
```

### 2. 開発者がMCPサーバーに直接アクセス

```javascript
// ステップ1: MCP Google認証でログイン
// ブラウザで https://mcp-api.example.com/auth/login/google にアクセス
// → Google認証 → MCPセッション確立

// ステップ2: MCPダッシュボードやツールに直接アクセス
const response = await fetch('https://mcp-api.example.com/mcp/tools/booking/service/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // MCPセッションCookie
  body: JSON.stringify({
    name: 'カット & カラー',
    description: '所要時間90分',
    duration: 90,
    price: 5000
  })
});
```

### 3. 公開エンドポイントを使用

```javascript
// 認証不要でアクセス可能
const response = await fetch('https://mcp-api.example.com/mcp/tools/product/search?q=laptop');
const products = await response.json();
```

## 認証フロー

### パターン1: AIサービス経由でMCP利用(エンドユーザー)

```
1. User → AIサービスフロントエンド
2. AIサービスでGoogle/LINE認証
3. OAuth完了 → AIサービスのセッションCookie設定
4. User → AIチャットでリクエスト送信
5. AIサービス → ユーザー意図を解析
6. AIサービス → MCPアクセストークン生成（DBに保存）
   - セキュアなランダムトークン生成
   - ユーザーID、スコープ、有効期限をDBに保存
7. AIサービス → MCP API呼び出し
   - Authorization: Bearer <random-token>
8. MCPサーバー → トークン検証（DB照合）
   - DBでトークンを検索
   - 有効期限チェック
   - スコープ確認
9. MCPサーバー → ユーザー情報をDBから取得
10. MCPサーバー → Tools実行
11. MCPサーバー → 結果を返す
12. AIサービス → 結果を整形してユーザーに返答
```

### パターン2: MCP直接アクセス(開発者/管理者)

```
1. Developer → https://mcp-api.example.com/auth/login/google
2. MCPサーバー → Google OAuthフロー開始
3. Developer → Google認証画面でログイン
4. Google → MCPサーバーのコールバックURL
5. MCPサーバー → トークン交換
6. MCPサーバー → Googleからユーザー情報取得
7. MCPサーバー → MCP管理者アカウント作成/取得
8. MCPサーバー → MCPセッション作成
9. MCPサーバー → セッションCookie設定(mcp_session)
10. Developer → MCPダッシュボードにリダイレクト
11. 以降のリクエスト → mcp_sessionで認証
```

### パターン3: 公開アクセス

```
1. Anyone → MCP公開エンドポイント
2. MCPサーバー → 認証スキップ
3. MCPサーバー → 公開データのみ返す
```

## セキュリティ機能

### 1. 認証の分離

- **AIサービス**: 独自のGoogle/LINE OAuth認証
  - エンドユーザー向け
  - セッションCookieで管理
  - MCPアクセストークンを発行する権限

- **MCPサーバー**: 独自のGoogle OAuth認証
  - 開発者/管理者向け
  - 別のセッション管理
  - 直接アクセス用

### 2. DBベース認証(AIサービス → MCP)

- **セキュアなランダムトークン使用**
  - `crypto.randomBytes()` で生成
  - DBに保存して検証
  - 改ざん防止

- **トークン情報（DBテーブル: McpAccessToken)**:
  ```typescript
  {
    id: string;
    userId: string;
    token: string;  // セキュアなランダム文字列
    scope: string[]; // ["booking:create", "product:read"]
    expiresAt: Date;
    createdAt: Date;
  }
  ```

- **有効期限**: 1時間(短期、DBで管理)
- **スコープ制御**: 必要最小限の権限のみ付与
- **即座に無効化可能**: DBから削除するだけ

### 3. セッション管理

#### AIサービスのセッション
- HttpOnly Cookie (XSS保護)
- Secure属性 (HTTPS通信のみ)
- SameSite=Lax (CSRF保護)
- 7日間の有効期限

#### MCPセッション
- 別のCookie名(`mcp_session`)
- 同様のセキュリティ属性
- 独立した有効期限管理

### 4. CORS設定

```typescript
// AIサービス
app.use('*', cors({
  origin: ['https://your-frontend.com'],
  credentials: true
}));

// MCPサーバー
app.use('*', cors({
  origin: [
    'https://ai-service.example.com', // AIサービスからのリクエスト
    'https://mcp-dashboard.example.com' // MCP管理画面
  ],
  credentials: true
}));
```

## 環境変数

### AIサービス (.env または Cloudflare Secrets)

```env
# AIサービス自身のGoogle/LINE OAuth
GOOGLE_CLIENT_ID=your-ai-service-google-client-id
GOOGLE_CLIENT_SECRET=your-ai-service-google-client-secret
GOOGLE_REDIRECT_URI=https://ai-service.example.com/auth/callback/google

LINE_CLIENT_ID=your-line-channel-id
LINE_CLIENT_SECRET=your-line-channel-secret
LINE_REDIRECT_URI=https://ai-service.example.com/auth/callback/line

# MCPアクセストークン用の鍵ペア
MCP_TOKEN_PRIVATE_KEY=your-private-key-for-signing
## 環境変数設定

### AIサービス (.dev.vars または Cloudflare Secrets)

```env
# Google OAuth(エンドユーザー認証用)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://ai-service.example.com/auth/callback/google

# LINE OAuth(エンドユーザー認証用)
LINE_CLIENT_ID=your-line-client-id
LINE_CLIENT_SECRET=your-line-client-secret
LINE_REDIRECT_URI=https://ai-service.example.com/auth/callback/line

# OpenAI API
OPENAI_API_KEY=sk-your-openai-key

# Database (共有)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# MCPサーバーのURL
MCP_SERVER_URL=https://mcp-api.example.com

# フロントエンドURL
FRONTEND_URL=https://your-frontend.com
```

### MCPサーバー (.dev.vars または Cloudflare Secrets)

```env
# MCP独自のGoogle OAuth(開発者/管理者用)
MCP_GOOGLE_CLIENT_ID=your-mcp-google-client-id
MCP_GOOGLE_CLIENT_SECRET=your-mcp-google-client-secret
MCP_GOOGLE_REDIRECT_URI=https://mcp-api.example.com/auth/callback/google

# Database (AIサービスと共有)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# CORS設定
ALLOWED_ORIGINS=https://ai-service.example.com,https://your-frontend.com
```

### Cloudflare Secrets設定

```bash
# AIサービス
cd packages/agent
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put LINE_CLIENT_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put DATABASE_URL

# MCPサーバー
cd packages/mcp-server
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put DATABASE_URL
```

## エンドポイント一覧

### AIサービス (`https://ai-service.example.com`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/auth/login/google` | GET | Public | Google認証開始 |
| `/auth/login/line` | GET | Public | LINE認証開始 |
| `/auth/callback/google` | GET | Public | Googleコールバック |
| `/auth/callback/line` | GET | Public | LINEコールバック |
| `/auth/logout` | POST | Auth | ログアウト |
| `/api/me` | GET | Auth | ユーザー情報 |
| `/api/conversations` | POST | Auth | 会話作成 |
| `/api/conversations/:id/messages` | POST | Auth | メッセージ送信(AI処理) |

### MCPサーバー (`https://mcp-api.example.com`)

#### 認証関連

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/auth/login/google` | GET | Public | MCP Google認証開始 |
| `/auth/callback/google` | GET | Public | MCPコールバック |
| `/auth/verify-token` | POST | - | トークン検証(内部用) |

#### 予約 (`/mcp/tools/booking/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/service/create` | POST | MCP-Auth | サービス作成 |
| `/available-slots` | GET | Public | 空き枠検索 |
| `/create` | POST | AI-Token/MCP-Auth | 予約作成 |
| `/:id` | GET | AI-Token/MCP-Auth | 予約詳細 |
| `/:id` | DELETE | AI-Token/MCP-Auth | 予約キャンセル |

#### 商品 (`/mcp/tools/product/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | MCP-Auth | 商品作成 |
| `/search` | GET | Public | 商品検索 |
| `/:id` | GET | Public | 商品詳細 |
| `/list` | GET | Public | 商品一覧 |
| `/:id` | PUT | MCP-Auth | 商品更新 |
| `/:id` | DELETE | MCP-Auth | 商品削除 |

#### 注文 (`/mcp/tools/order/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | AI-Token/MCP-Auth | 注文作成 |
| `/:id` | GET | AI-Token/MCP-Auth | 注文詳細 |
| `/user/list` | GET | AI-Token/MCP-Auth | 自分の注文一覧 |
| `/:id` | DELETE | AI-Token/MCP-Auth | 注文キャンセル |
| `/list` | GET | MCP-Auth | 全注文一覧 |
| `/:id/status` | PUT | MCP-Auth | ステータス更新 |

#### フォーム (`/mcp/tools/form/...`)

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/create` | POST | MCP-Auth | フォーム作成 |
| `/:id` | GET | Public | フォーム取得 |
| `/:id/submit` | POST | Public | 送信 |
| `/:id/submissions` | GET | MCP-Auth | 送信一覧 |
| `/submission/:id` | GET | MCP-Auth | 送信詳細 |

**認証の種類**:
- `Public`: 認証不要
- `AI-Token`: AIサービス発行トークン
- `MCP-Auth`: MCP独自Google認証
- `AI-Token/MCP-Auth`: どちらか一方で可

## 今後の拡張

### データベーススキーマ

AIサービスとMCPで分離されたユーザー管理:

```prisma
// AIサービス用
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  picture    String?
  provider   String   // "google" or "line"
  providerId String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sessions      Session[]
  conversations Conversation[]
  mcpTokens     McpAccessToken[]

  @@unique([provider, providerId])
  @@map("users")
}

model McpAccessToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  scope     String[]
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
  @@map("mcp_access_tokens")
}

// MCPサーバー用
model McpUser {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  picture    String?
  provider   String   // "google" (MCP独自認証)
  providerId String
  role       String   @default("admin") // "admin" or "developer"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sessions McpSession[]

  @@unique([provider, providerId])
  @@map("mcp_users")
}

model McpSession {
  id        String   @id @default(cuid())
  userId    String
  user      McpUser  @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("mcp_sessions")
}
```

### トークンリフレッシュ

- 短期トークン(1時間)と長期リフレッシュトークン
- 自動更新メカニズム

### レート制限

- ユーザーごとのAPI呼び出し制限
- トークンごとの制限

### 監査ログ

- すべてのMCP操作を記録
- どのAIサービスユーザーがどの操作を行ったか追跡

### マルチテナント対応

- 複数のAIサービスがMCPを利用
- AIサービスごとの分離
- テナントID管理

## トラブルシューティング

### AIサービスからMCPへのアクセスが失敗する

1. **トークン生成の確認**
   - `DATABASE_URL`が両サービスで正しく設定されているか
   - トークンが正常にDBに保存されているか
   - `mcp_access_tokens`テーブルを確認

   ```sql
   SELECT * FROM mcp_access_tokens WHERE user_id = 'YOUR_USER_ID';
   ```

2. **トークン検証の確認**
   - MCPサーバーが同じデータベースに接続しているか
   - トークンが有効期限内か
   - スコープが正しく設定されているか

3. **有効期限**
   - トークンが期限切れでないか（デフォルト1時間）
   - 期限切れトークンは自動的に削除される

4. **データベース接続**
   - 両サービスが同じDBインスタンスに接続しているか
   - ネットワーク接続が正常か

### MCP Google認証が機能しない

1. **OAuth設定の確認**
   - `MCP_GOOGLE_CLIENT_ID`と`MCP_GOOGLE_CLIENT_SECRET`が正しいか
   - Google Cloud ConsoleでリダイレクトURIが登録されているか

2. **コールバックURL**
   - `MCP_GOOGLE_REDIRECT_URI`が正しいか
   - HTTPSを使用しているか(本番環境)

### CORS エラー

1. **AIサービス側**
   - フロントエンドのオリジンが許可リストに含まれているか
   - `credentials: true`が設定されているか

2. **MCPサーバー側**
   - AIサービスのドメインが許可リストに含まれているか
   - プリフライトリクエストが正しく処理されているか

### データベース接続エラー

1. **接続文字列**
   - `DATABASE_URL`が正しく設定されているか
   - データベースがアクセス可能か

2. **Prisma**
   - マイグレーションが適用されているか
   - `prisma generate`が実行されているか

## 参考資料

- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) - OAuth認証の詳細
- [MCP_USAGE.md](./MCP_USAGE.md) - MCPエンドポイントの使い方
- [Hono Middleware](https://hono.dev/docs/guides/middleware)

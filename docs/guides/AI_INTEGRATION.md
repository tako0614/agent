# AI統合ガイド

## OpenAI API統合

このプロジェクトにはOpenAI APIとLangGraphを使用したAIエージェント機能が統合されています。

### セットアップ

1. **OpenAI APIキーの取得**
   - [OpenAI Platform](https://platform.openai.com/)にアクセス
   - APIキーを作成

2. **環境変数の設定**
   
   開発環境の場合:
   ```powershell
   cd packages/agent
   cp .dev.vars.example .dev.vars
   ```
   
   `.dev.vars`ファイルを編集して、APIキーを設定:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   DATABASE_URL=your-database-url
   STRIPE_SECRET_KEY=your-stripe-key
   ```

   本番環境の場合:
   ```powershell
   cd packages/agent
   wrangler secret put OPENAI_API_KEY
   wrangler secret put DATABASE_URL
   wrangler secret put STRIPE_SECRET_KEY
   ```

3. **開発サーバーの起動**
   ```powershell
   npm run dev
   ```

### AI機能

#### 1. メッセージAPI

通常のリクエスト-レスポンス形式:
```typescript
POST /api/conversations/:id/messages
Content-Type: application/json

{
  "content": "予約システムを作りたいです",
  "history": [
    { "role": "user", "content": "こんにちは" },
    { "role": "assistant", "content": "こんにちは!何をお手伝いしましょうか?" }
  ]
}
```

レスポンス:
```json
{
  "id": "msg_1234567890",
  "conversationId": "conv_demo",
  "role": "assistant",
  "content": "予約システムの作成をお手伝いします...",
  "toolCall": {
    "name": "booking_tool",
    "params": { "action": "create", ... }
  },
  "toolResult": { "success": true, ... },
  "createdAt": "2025-10-01T00:00:00.000Z"
}
```

#### 2. ストリーミングAPI

リアルタイムストリーミングレスポンス:
```typescript
POST /api/conversations/:id/messages/stream
Content-Type: application/json

{
  "content": "商品を検索してください",
  "history": []
}
```

レスポンスはServer-Sent Events (SSE)形式でストリーミングされます。

### AIエージェントのツール

AIエージェントは以下のツールを使用できます:

#### 1. booking_tool - 予約システム
```typescript
{
  "action": "list" | "create" | "cancel",
  "serviceId": "string",
  "date": "YYYY-MM-DD",
  "name": "string",
  "email": "string",
  "bookingId": "string"
}
```

**例:**
- 「明日の予約を確認したい」
- 「10月15日に予約を作成してください」
- 「予約をキャンセルしたい」

#### 2. product_tool - 商品カタログ
```typescript
{
  "action": "list" | "search" | "details",
  "query": "string",
  "productId": "string"
}
```

**例:**
- 「商品一覧を表示して」
- 「Tシャツを探してください」
- 「この商品の詳細を教えて」

#### 3. order_tool - 注文管理
```typescript
{
  "action": "create" | "list" | "status",
  "userId": "string",
  "productId": "string",
  "quantity": number,
  "orderId": "string"
}
```

**例:**
- 「この商品を2つ注文したい」
- 「注文履歴を見せて」
- 「注文のステータスを確認したい」

#### 4. form_tool - フォーム管理
```typescript
{
  "action": "create" | "submit" | "list",
  "formId": "string",
  "title": "string",
  "description": "string",
  "fields": [{ "name": "string", "type": "string", "required": boolean }],
  "data": { [key: string]: any }
}
```

**例:**
- 「お問い合わせフォームを作成して」
- 「フォームに回答を送信したい」
- 「フォーム一覧を表示して」

### アーキテクチャ

```
User → Frontend (SolidJS)
         ↓
    API Endpoint (/api/conversations/:id/messages)
         ↓
    AI Agent (LangGraph + OpenAI)
         ↓
    Tool Executor
         ↓
    MCP Tools (/mcp/tools/*)
         ↓
    Database (Prisma + PostgreSQL)
```

### カスタマイズ

#### プロンプトのカスタマイズ

`packages/agent/worker/ai/agent.ts`の`agentNode`メソッド内の`systemPrompt`を編集:

```typescript
const systemPrompt = `あなたは万能AIエージェントです...`;
```

#### モデルの変更

```typescript
this.model = new ChatOpenAI({
  modelName: 'gpt-4o-mini', // または 'gpt-4', 'gpt-4-turbo' など
  temperature: 0.7,
  openAIApiKey: apiKey,
});
```

#### 新しいツールの追加

1. `packages/agent/worker/ai/agent.ts`にツールスキーマを追加
2. `packages/agent/worker/ai/tools.ts`にツール実行ロジックを追加
3. `packages/agent/worker/mcp/index.ts`にMCPエンドポイントを追加

### トラブルシューティング

#### エラー: "OpenAI API key not configured"

`.dev.vars`ファイルに正しいAPIキーが設定されているか確認してください。

#### エラー: "Failed to process message"

1. OpenAI APIキーが有効か確認
2. APIクレジットが残っているか確認
3. ネットワーク接続を確認

#### ツールが実行されない

1. ツールのスキーマが正しく定義されているか確認
2. MCPエンドポイントが正しく動作しているか確認
3. ブラウザのコンソールでエラーを確認

### 次のステップ

- [ ] データベースとの統合
- [ ] ストリーミングレスポンスのフロントエンド実装
- [ ] ツール実行結果の視覚化
- [ ] ユーザー認証の実装
- [ ] Stripe決済の統合

### 参考リンク

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)

import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START } from '@langchain/langgraph';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// State definition for the agent
export interface AgentState {
  messages: Array<{ role: string; content: string }>;
  currentTool?: string;
  toolResult?: any;
  nextAction?: string;
}

// Tool schemas - Both Admin and User actions
const BookingToolSchema = z.object({
  action: z.enum([
    'list_slots',      // [PUBLIC] 利用可能な予約枠を確認
    'create',          // [PUBLIC] 予約を作成(ユーザーが予約)
    'get',             // [PUBLIC] 予約詳細を取得
    'cancel',          // [PUBLIC] 予約をキャンセル
    'create_service',  // [ADMIN] 予約サービスを作成
    'list_all'         // [ADMIN] 全予約を確認
  ]),
  serviceId: z.string().optional(),
  date: z.string().optional(),
  slotId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  bookingId: z.string().optional(),
  // For creating service
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  duration: z.number().optional(),
  price: z.number().optional(),
});

const ProductToolSchema = z.object({
  action: z.enum([
    'search',          // [PUBLIC] 商品を検索
    'get',             // [PUBLIC] 商品詳細を取得
    'list',            // [PUBLIC] 商品一覧を表示
    'create',          // [ADMIN] 商品を作成
    'update',          // [ADMIN] 商品を更新
    'delete'           // [ADMIN] 商品を削除
  ]),
  query: z.string().optional(),
  category: z.string().optional(),
  productId: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  // For creating/updating product
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  stock: z.number().optional(),
  images: z.array(z.string()).optional(),
});

const OrderToolSchema = z.object({
  action: z.enum([
    'create',          // [PUBLIC] 注文を作成(ユーザーが購入)
    'get',             // [PUBLIC] 注文詳細を確認
    'list_user',       // [PUBLIC] ユーザーの注文履歴
    'cancel',          // [PUBLIC] 注文をキャンセル
    'list_all',        // [ADMIN] 全注文を確認
    'update_status'    // [ADMIN] 注文ステータスを更新
  ]),
  userId: z.string().optional(),
  orderId: z.string().optional(),
  // For creating order
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number(),
  })).optional(),
  shippingAddress: z.object({
    name: z.string(),
    phone: z.string(),
    postalCode: z.string(),
    address: z.string(),
  }).optional(),
  // For updating status
  status: z.string().optional(),
  trackingNumber: z.string().optional(),
});

const FormToolSchema = z.object({
  action: z.enum([
    'get',             // [PUBLIC] フォームを取得(表示用)
    'submit',          // [PUBLIC] フォームに回答(ユーザーが送信)
    'create',          // [ADMIN] フォームを作成
    'list',            // [ADMIN] フォーム一覧
    'list_submissions',// [ADMIN] 回答一覧
    'update',          // [ADMIN] フォームを更新
    'delete'           // [ADMIN] フォームを削除
  ]),
  formId: z.string().optional(),
  // For creating form
  name: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
  })).optional(),
  settings: z.object({
    enableNotifications: z.boolean().optional(),
    notificationEmail: z.string().optional(),
    successMessage: z.string().optional(),
  }).optional(),
  // For submitting form
  data: z.record(z.any()).optional(),
  submitterName: z.string().optional(),
  submitterEmail: z.string().optional(),
});

// Available tools configuration
const tools = [
  {
    name: 'booking_tool',
    description: `予約システムを操作します。
    
利用者向け機能:
- 利用可能な予約枠を確認 (action: 'list_slots')
- 予約を作成 (action: 'create')
- 予約詳細を確認 (action: 'get')
- 予約をキャンセル (action: 'cancel')

管理者向け機能:
- 予約サービスを作成 (action: 'create_service')
- 全予約を確認 (action: 'list_all')`,
    schema: zodToJsonSchema(BookingToolSchema),
  },
  {
    name: 'product_tool',
    description: `商品カタログを操作します。
    
利用者向け機能:
- 商品を検索 (action: 'search')
- 商品一覧を表示 (action: 'list')
- 商品詳細を取得 (action: 'get')

管理者向け機能:
- 商品を作成 (action: 'create')
- 商品を更新 (action: 'update')
- 商品を削除 (action: 'delete')`,
    schema: zodToJsonSchema(ProductToolSchema),
  },
  {
    name: 'order_tool',
    description: `注文を管理します。
    
利用者向け機能:
- 注文を作成(購入) (action: 'create')
- 注文詳細を確認 (action: 'get')
- 注文履歴を確認 (action: 'list_user')
- 注文をキャンセル (action: 'cancel')

管理者向け機能:
- 全注文を確認 (action: 'list_all')
- 注文ステータスを更新 (action: 'update_status')`,
    schema: zodToJsonSchema(OrderToolSchema),
  },
  {
    name: 'form_tool',
    description: `フォームを管理します。
    
利用者向け機能:
- フォームを表示 (action: 'get')
- フォームに回答して送信 (action: 'submit')

管理者向け機能:
- フォームを作成 (action: 'create')
- フォーム一覧を表示 (action: 'list')
- 回答一覧を確認 (action: 'list_submissions')
- フォームを更新 (action: 'update')
- フォームを削除 (action: 'delete')`,
    schema: zodToJsonSchema(FormToolSchema),
  },
];

export class AIAgent {
  private model: ChatOpenAI;
  private graph: any;

  constructor(apiKey: string) {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: apiKey,
    });

    this.graph = this.createGraph();
  }

  private createGraph() {
    const workflow = new StateGraph<AgentState>({
      channels: {
        messages: {
          value: (left: any[], right: any[]) => left.concat(right),
          default: () => [],
        },
        currentTool: {
          value: (left: any, right: any) => right ?? left,
          default: () => undefined,
        },
        toolResult: {
          value: (left: any, right: any) => right ?? left,
          default: () => undefined,
        },
        nextAction: {
          value: (left: any, right: any) => right ?? left,
          default: () => undefined,
        },
      },
    });

    // Add nodes
    workflow.addNode('agent', this.agentNode.bind(this));
    workflow.addNode('tools', this.toolsNode.bind(this));

    // Add edges
    workflow.addEdge(START, 'agent');
    workflow.addConditionalEdges(
      'agent',
      this.shouldContinue.bind(this),
      {
        continue: 'tools',
        end: END,
      }
    );
    workflow.addEdge('tools', 'agent');

    return workflow.compile();
  }

  private async agentNode(state: AgentState): Promise<Partial<AgentState>> {
    const systemPrompt = `あなたは万能AIエージェントです。ユーザーの要求に応じて、以下のツールを使用してサービスを提供します:

1. booking_tool: 予約システム(予約作成、一覧、キャンセル)
2. product_tool: 商品カタログ(検索、一覧、詳細)
3. order_tool: 注文管理(注文作成、一覧、ステータス)
4. form_tool: フォーム管理(作成、送信、一覧)

ユーザーの要求を理解し、適切なツールを選択して実行してください。
ツールを使う必要がある場合は、tool_call形式で応答してください。
ツールを使う必要がない場合は、通常の会話として応答してください。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...state.messages,
    ];

    // Check if we have a tool result to incorporate
    if (state.toolResult) {
      messages.push({
        role: 'assistant',
        content: `ツール実行結果: ${JSON.stringify(state.toolResult)}`,
      });
    }

    const response = await this.model.invoke(messages as any);
    const content = this.toText(response.content);

    // Parse response to check if it's a tool call
    const toolCallMatch = content.match(/tool_call:\s*(\w+)\s*\((.*)\)/);
    
    if (toolCallMatch) {
      const [, toolName, paramsStr] = toolCallMatch;
      try {
        const params = JSON.parse(paramsStr || '{}');
        return {
          currentTool: toolName,
          nextAction: 'continue',
          messages: [{ role: 'assistant', content }],
        };
      } catch (e) {
        return {
          nextAction: 'end',
          messages: [
            { role: 'assistant', content },
            {
              role: 'assistant',
              content: 'ツール呼び出しのパースに失敗しました。',
            },
          ],
        };
      }
    }

    return {
      nextAction: 'end',
      messages: [{ role: 'assistant', content }],
    };
  }

  private async toolsNode(state: AgentState): Promise<Partial<AgentState>> {
    // This is a placeholder - actual tool execution will be handled by the Worker
    // The Worker will call the MCP endpoints
    return {
      toolResult: { status: 'pending', tool: state.currentTool },
      currentTool: undefined,
    };
  }

  private shouldContinue(state: AgentState): string {
    return state.nextAction === 'continue' ? 'continue' : 'end';
  }

  async processMessage(
    conversationHistory: Array<{ role: string; content: string }>,
    userMessage: string
  ): Promise<{
    response: string;
    toolCall?: { name: string; params: any };
  }> {
    const initialState: AgentState = {
      messages: [
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ],
    };

    const result = await this.graph.invoke(initialState);
    
    const lastMessage = result.messages[result.messages.length - 1];
    const response = lastMessage ? this.toText(lastMessage.content) : '';

    // Extract tool call if present
    const toolCallMatch = response.match(/tool_call:\s*(\w+)\s*\((.*)\)/);
    if (toolCallMatch) {
      const [, toolName, paramsStr] = toolCallMatch;
      try {
        const params = JSON.parse(paramsStr || '{}');
        return {
          response,
          toolCall: { name: toolName, params },
        };
      } catch (e) {
        return { response };
      }
    }

    return { response };
  }

  async streamResponse(
    conversationHistory: Array<{ role: string; content: string }>,
    userMessage: string
  ): Promise<ReadableStream> {
    const systemPrompt = `あなたは万能AIエージェントです。ユーザーの要求に応じて、以下のツールを使用してサービスを提供します:

1. booking_tool: 予約システム(予約作成、一覧、キャンセル)
2. product_tool: 商品カタログ(検索、一覧、詳細)
3. order_tool: 注文管理(注文作成、一覧、ステータス)
4. form_tool: フォーム管理(作成、送信、一覧)

ユーザーと自然に会話し、必要に応じてツールを使用してください。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const stream = await this.model.stream(messages as any);

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = this.toText(chunk?.content);
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  private toText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
            return part.text;
          }
          return '';
        })
        .join('');
    }
    if (content && typeof content === 'object') {
      if ('text' in content && typeof content.text === 'string') return content.text;
      if ('message' in content && typeof content.message === 'string') return content.message;
    }
    return content != null ? String(content) : '';
  }
}

export function createAIAgent(apiKey: string): AIAgent {
  return new AIAgent(apiKey);
}

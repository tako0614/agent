import { createAIAgent } from './agent';

export type AgentMode = 'chat' | 'agent' | 'auto';

interface PlanStep {
  step: string;
  description: string;
  toolCall?: { name: string; params: any };
}

/**
 * Determine which mode to use based on user input
 */
export async function determineMode(
  userMessage: string,
  apiKey: string
): Promise<AgentMode> {
  const agent = createAIAgent(apiKey);

  const systemPrompt = `あなたはユーザーの意図を判断するAIです。
以下の2つのモードから最適なものを選択してください:

- "chat": シンプルな質問や会話。情報取得、説明、相談など。
- "agent": 複数のステップが必要な複雑なタスク。サービスの作成、データの操作、連続した作業など。

ユーザーのメッセージを分析して、"chat" または "agent" のいずれかを返してください。
返答は必ず "chat" または "agent" のみとしてください。`;

  const result = await agent.processMessage(
    [{ role: 'system', content: systemPrompt }],
    userMessage
  );

  const content = result.response.toLowerCase().trim();
  if (content.includes('agent')) return 'agent';
  return 'chat';
}

/**
 * Create an execution plan for agent mode
 */
export async function createPlan(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<PlanStep[]> {
  const agent = createAIAgent(apiKey);

  const systemPrompt = `あなたはタスクを実行計画に分解するAIです。
ユーザーのリクエストを分析し、具体的な実行ステップのリストを作成してください。

各ステップは以下の形式でJSON配列として返してください:
[
  {"step": "ステップ1の説明", "description": "詳細な説明"},
  {"step": "ステップ2の説明", "description": "詳細な説明"}
]

ステップは簡潔で明確にし、順番に実行できるようにしてください。
最大5ステップまでとしてください。`;

  const result = await agent.processMessage(
    [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ],
    `以下のリクエストの実行計画を作成してください:\n${userMessage}`
  );

  const content = result.response;

  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const steps = JSON.parse(jsonMatch[0]) as PlanStep[];
      return steps;
    }
  } catch (e) {
    console.error('Failed to parse plan:', e);
  }

  // Fallback: create a simple plan
  return [
    { step: 'タスクを分析', description: 'ユーザーのリクエストを理解する' },
    { step: '実行', description: 'タスクを実行する' },
    { step: '結果を確認', description: '実行結果を確認して報告する' },
  ];
}

/**
 * Execute agent mode with plan
 */
export async function executeAgentMode(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string,
  executeToolFn: (toolCall: { name: string; params: any }) => Promise<any>
): Promise<{
  response: string;
  planSteps: string[];
  currentStep: number;
  toolCalls?: Array<{ name: string; params: any; result: any }>;
}> {
  // 1. Create execution plan
  const plan = await createPlan(userMessage, conversationHistory, apiKey);
  const planSteps = plan.map(p => p.step);

  const agent = createAIAgent(apiKey);
  let currentResponse = '';
  const toolCalls: Array<{ name: string; params: any; result: any }> = [];

  // 2. Execute each step
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    
    const systemPrompt = `あなたは自律型AIエージェントです。
現在のステップ: ${step.step}
説明: ${step.description}

このステップを実行してください。必要に応じてツールを使用できます。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    if (currentResponse) {
      messages.push({ role: 'assistant', content: `前のステップの結果: ${currentResponse}` });
    }

    const result = await agent.processMessage(messages, userMessage);
    
    // Check for tool calls
    if (result.toolCall) {
      try {
        const toolResult = await executeToolFn(result.toolCall);
        toolCalls.push({ ...result.toolCall, result: toolResult });
        currentResponse += `\n\nステップ ${i + 1} 完了: ${step.step}\n結果: ${JSON.stringify(toolResult, null, 2)}`;
      } catch (e) {
        currentResponse += `\n\nステップ ${i + 1} でエラーが発生しました: ${step.step}`;
      }
    } else {
      currentResponse += `\n\n${result.response}`;
    }
  }

  // 3. Generate final response
  const finalResult = await agent.processMessage(
    [
      { role: 'system', content: 'タスクの実行が完了しました。ユーザーに結果を分かりやすく報告してください。' },
      ...conversationHistory,
      { role: 'assistant', content: currentResponse },
    ],
    userMessage
  );

  return {
    response: finalResult.response,
    planSteps,
    currentStep: plan.length,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

/**
 * Execute chat mode (simple Q&A)
 */
export async function executeChatMode(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<string> {
  const agent = createAIAgent(apiKey);

  const systemPrompt = `あなたは親切なAIアシスタントです。
ユーザーの質問に分かりやすく答えてください。`;

  const result = await agent.processMessage(
    [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ],
    userMessage
  );

  return result.response;
}

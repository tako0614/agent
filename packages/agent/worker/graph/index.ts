/**
 * LangGraph Agent Graph Construction
 */

import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { GraphAnnotation } from './state';
import { inputNode, planningNode, toolExecutionNode, synthesisNode } from './nodes';
import { createBuiltInTools } from './tools';
import type { PrismaClient } from '@agent/database';

export interface CreateAgentGraphOptions {
  prisma: PrismaClient;
  userId: string;
  openaiApiKey: string;
  mcpBaseUrl: string;
  serviceToken: string | null;
  modelName?: string;
  temperature?: number;
}

export function createAgentGraph(options: CreateAgentGraphOptions) {
  const {
    prisma,
    userId,
    openaiApiKey,
    mcpBaseUrl,
    serviceToken,
    modelName = 'gpt-4o-mini',
    temperature = 0.7,
  } = options;

  const llm = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    modelName,
    temperature,
  });

  const tools = createBuiltInTools(prisma, userId, mcpBaseUrl, serviceToken);

  const graph = new StateGraph(GraphAnnotation)
    .addNode('input', inputNode)
    .addNode('planning', (state) => planningNode(state, llm, tools))
    .addNode('tool_execution', (state) => toolExecutionNode(state, tools))
    .addNode('synthesis', (state) => synthesisNode(state, llm))
    .addEdge('__start__', 'input')
    .addConditionalEdges('input', (state) => state.nextStep || 'end')
    .addConditionalEdges('planning', (state) => state.nextStep || 'end')
    .addConditionalEdges('tool_execution', (state) => state.nextStep || 'end')
    .addConditionalEdges('synthesis', (state) => state.nextStep || 'end');

  return graph.compile();
}

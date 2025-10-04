/**
 * LangGraph Node Implementations
 */

import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { GraphState } from './state';

const SYSTEM_PROMPT = `You are an AI agent assistant that helps users manage and interact with MCP (Model Context Protocol) servers.

You have access to the following built-in tools:
- search_mcp_servers: Search for available MCP servers
- add_mcp_server: Add an MCP server to the user's agent
- list_my_mcp_servers: List all linked MCP servers
- remove_mcp_server: Remove or disable an MCP server

When a user asks about MCP servers, use the appropriate tools to help them. Be concise and helpful.`;

export async function inputNode(state: GraphState): Promise<Partial<GraphState>> {
  // Input node: validate and prepare messages
  const messages = state.messages || [];
  
  if (messages.length === 0) {
    return {
      error: 'No messages provided',
      nextStep: 'end',
    };
  }

  // Add system prompt if not already present
  const hasSystemMessage = messages.some((m) => m._getType() === 'system');
  if (!hasSystemMessage) {
    return {
      messages: [new SystemMessage(SYSTEM_PROMPT)],
      nextStep: 'planning',
    };
  }

  return {
    nextStep: 'planning',
  };
}

export async function planningNode(
  state: GraphState,
  llm: ChatOpenAI,
  tools: Array<any>
): Promise<Partial<GraphState>> {
  // Planning node: use LLM to decide what to do
  try {
    const llmWithTools = llm.bindTools(tools);
    const response = await llmWithTools.invoke(state.messages);

    // Check if the LLM wants to call tools
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;

    return {
      messages: [response],
      nextStep: hasToolCalls ? 'tool_execution' : 'synthesis',
    };
  } catch (error) {
    return {
      error: `Planning failed: ${(error as Error).message}`,
      nextStep: 'end',
    };
  }
}

export async function toolExecutionNode(
  state: GraphState,
  tools: Array<any>
): Promise<Partial<GraphState>> {
  // Tool execution node: execute requested tools
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage._getType() !== 'ai') {
    return {
      error: 'No AI message with tool calls found',
      nextStep: 'end',
    };
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    return {
      nextStep: 'synthesis',
    };
  }

  const toolMap = new Map(tools.map((t) => [t.name, t]));
  const toolMessages = [];

  for (const toolCall of toolCalls) {
    const tool = toolMap.get(toolCall.name);
    if (!tool) {
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          name: toolCall.name,
          content: `Tool '${toolCall.name}' not found`,
        })
      );
      continue;
    }

    try {
      const result = await tool.invoke(toolCall.args);
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          name: toolCall.name,
          content: JSON.stringify(result),
        })
      );
    } catch (error) {
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          name: toolCall.name,
          content: `Error executing tool: ${(error as Error).message}`,
        })
      );
    }
  }

  return {
    messages: toolMessages,
    nextStep: 'planning', // Loop back to planning to synthesize results
  };
}

export async function synthesisNode(
  state: GraphState,
  llm: ChatOpenAI
): Promise<Partial<GraphState>> {
  // Synthesis node: generate final response
  try {
    const response = await llm.invoke(state.messages);

    return {
      messages: [response],
      nextStep: 'end',
    };
  } catch (error) {
    return {
      error: `Synthesis failed: ${(error as Error).message}`,
      nextStep: 'end',
    };
  }
}

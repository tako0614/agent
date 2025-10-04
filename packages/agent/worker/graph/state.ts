/**
 * LangGraph State Definition
 */

import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  mcpLinks: Annotation<Array<{ id: string; mcpServerId: string; enabled: boolean }>>({
    reducer: (_, update) => update,
    default: () => [],
  }),
  nextStep: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

export type GraphState = typeof GraphAnnotation.State;

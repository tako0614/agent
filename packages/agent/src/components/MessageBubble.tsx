import { Component, Show } from 'solid-js';
import { SolidMarkdown } from 'solid-markdown';
import remarkGfm from 'remark-gfm';
import { AgentSteps } from './AgentSteps';
import type { AgentMode } from '../types';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  mode?: AgentMode;
  planSteps?: string[];
  currentStep?: number;
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isUser = () => props.role === 'user';

  return (
    <div
      class={`flex ${isUser() ? 'justify-end' : 'justify-start'}`}
    >
      <div
        class={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser()
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        {/* Show Agent Steps if available */}
        <Show when={!isUser() && props.planSteps && props.planSteps.length > 0}>
          <AgentSteps 
            steps={props.planSteps!} 
            currentStep={props.currentStep ?? 0} 
          />
        </Show>
        
        {isUser() ? (
          <p class="whitespace-pre-wrap">{props.content}</p>
        ) : (
          <div class="prose prose-sm max-w-none">
            <SolidMarkdown
              children={props.content}
              remarkPlugins={[remarkGfm]}
            />
          </div>
        )}
        <p
          class={`text-xs mt-2 ${
            isUser() ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {new Date(props.timestamp).toLocaleTimeString('ja-JP')}
          <Show when={props.mode}>
            <span class={`ml-2 ${isUser() ? 'text-blue-200' : 'text-gray-400'}`}>
              [{props.mode}]
            </span>
          </Show>
        </p>
      </div>
    </div>
  );
};

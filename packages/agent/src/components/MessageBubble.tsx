import { Component } from 'solid-js';
import { SolidMarkdown } from 'solid-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
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
        </p>
      </div>
    </div>
  );
};

/**
 * チャットメッセージコンポーネント
 */

import { type Component } from 'solid-js';
import type { ConversationMessage } from '../types/api';

interface MessageItemProps {
  message: ConversationMessage;
}

export const MessageItem: Component<MessageItemProps> = (props) => {
  const isUser = () => props.message.role === 'user';
  
  return (
    <div
      class={`mb-4 flex ${isUser() ? 'justify-end' : 'justify-start'}`}
    >
      <div
        class={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser()
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
        }`}
      >
        <div class="text-xs opacity-70 mb-1">{props.message.role}</div>
        <div class="whitespace-pre-wrap">{props.message.content}</div>
        {props.message.metadata && (
          <details class="mt-2 text-xs opacity-80">
            <summary class="cursor-pointer">メタデータ</summary>
            <pre class="mt-1 overflow-auto">
              {JSON.stringify(props.message.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

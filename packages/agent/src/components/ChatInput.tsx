import { Component, createSignal } from 'solid-js';
import { Send } from 'lucide-solid';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: Component<ChatInputProps> = (props) => {
  const [input, setInput] = createSignal('');

  const handleSend = () => {
    const text = input().trim();
    if (!text || props.disabled) return;
    
    props.onSend(text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="flex gap-2">
      <textarea
        value={input()}
        onInput={(e) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder || 'メッセージを入力... (Shift+Enterで改行)'}
        class="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={1}
        disabled={props.disabled}
      />
      <button
        onClick={handleSend}
        disabled={!input().trim() || props.disabled}
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        <Send class="w-5 h-5" />
      </button>
    </div>
  );
};

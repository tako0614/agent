import { Component } from 'solid-js';
import { Bot, MessageSquare, Sparkles } from 'lucide-solid';
import type { AgentMode } from '../types';

interface ModeSelectorProps {
  currentMode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
}

export const ModeSelector: Component<ModeSelectorProps> = (props) => {
  return (
    <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => props.onModeChange('chat')}
        class={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          props.currentMode === 'chat'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="質問応答モード - シンプルな会話形式"
      >
        <MessageSquare class="w-4 h-4" />
        <span class="font-medium">Chat</span>
      </button>
      
      <button
        onClick={() => props.onModeChange('agent')}
        class={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          props.currentMode === 'agent'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="自律型AIエージェントモード - 計画的に実行"
      >
        <Bot class="w-4 h-4" />
        <span class="font-medium">Agent</span>
      </button>
      
      <button
        onClick={() => props.onModeChange('auto')}
        class={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          props.currentMode === 'auto'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="自動切り替えモード - 状況に応じて最適なモードを選択"
      >
        <Sparkles class="w-4 h-4" />
        <span class="font-medium">Auto</span>
      </button>
    </div>
  );
};

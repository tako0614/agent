/**
 * MCPサーバー一覧コンポーネント
 */

import { type Component, For, Show } from 'solid-js';
import type { AgentMcpLink } from '../types/api';

interface McpListProps {
  mcps: AgentMcpLink[];
  onUnlink?: (linkId: string) => void;
  onTest?: (mcpServerId: string) => void;
}

export const McpList: Component<McpListProps> = (props) => {
  return (
    <div class="space-y-2">
      <Show when={props.mcps.length === 0}>
        <p class="text-gray-500 text-sm">MCPサーバーが登録されていません</p>
      </Show>
      <For each={props.mcps}>
        {(link) => (
          <div class="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-semibold text-sm">
                  {link.server?.name || link.mcpServerId}
                </h3>
                <Show when={link.server?.description}>
                  <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {link.server!.description}
                  </p>
                </Show>
                <div class="flex items-center gap-2 mt-2 text-xs">
                  <span
                    class={`px-2 py-1 rounded ${
                      link.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {link.enabled ? '有効' : '無効'}
                  </span>
                  <Show when={link.server?.status}>
                    <span
                      class={`px-2 py-1 rounded ${
                        link.server!.status === 'ACTIVE'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {link.server!.status}
                    </span>
                  </Show>
                </div>
              </div>
              <div class="flex gap-2 ml-2">
                <Show when={props.onTest}>
                  <button
                    class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => props.onTest!(link.mcpServerId)}
                  >
                    テスト
                  </button>
                </Show>
                <Show when={props.onUnlink}>
                  <button
                    class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={() => props.onUnlink!(link.id)}
                  >
                    削除
                  </button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

/**
 * MCP検索・追加コンポーネント
 */

import { type Component, createSignal, For, Show } from 'solid-js';
import type { McpServer } from '../types/api';

interface McpSearchProps {
  onSearch: (query: string, tags?: string[]) => Promise<McpServer[]>;
  onLink: (serverId: string) => Promise<void>;
}

export const McpSearch: Component<McpSearchProps> = (props) => {
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<McpServer[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSearch = async () => {
    if (!query().trim()) return;

    setLoading(true);
    setError(null);

    try {
      const items = await props.onSearch(query());
      setResults(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (serverId: string) => {
    try {
      await props.onLink(serverId);
      alert('MCPサーバーを追加しました');
      setResults([]);
      setQuery('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'MCPの追加に失敗しました');
    }
  };

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <input
          type="text"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="MCPサーバーを検索..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSearch}
          disabled={loading()}
        >
          {loading() ? '検索中...' : '検索'}
        </button>
      </div>

      <Show when={error()}>
        <div class="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={results().length > 0}>
        <div class="space-y-2">
          <h3 class="font-semibold text-sm">検索結果</h3>
          <For each={results()}>
            {(server) => (
              <div class="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="font-semibold text-sm">{server.name}</h4>
                    <Show when={server.description}>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {server.description}
                      </p>
                    </Show>
                    <div class="flex gap-2 mt-2">
                      <Show when={server.tags}>
                        <For each={server.tags}>
                          {(tag) => (
                            <span class="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                              {tag.tag}
                            </span>
                          )}
                        </For>
                      </Show>
                    </div>
                  </div>
                  <button
                    class="ml-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    onClick={() => handleLink(server.id)}
                  >
                    追加
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

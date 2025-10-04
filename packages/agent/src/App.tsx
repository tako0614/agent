/**
 * メインアプリケーションコンポーネント
 * DETAILED_SPEC.mdの仕様に基づくチャットUIとMCP管理機能
 */

import { type Component, createSignal, onMount, Show, For } from 'solid-js';
import { apiClient } from './lib/api-client';
import { MessageItem } from './components/MessageItem';
import { McpList } from './components/McpList';
import { McpSearch } from './components/McpSearch';
import type {
  User,
  ConversationMessage,
  AgentMcpLink,
} from './types/api';

const App: Component = () => {
  // ユーザー状態
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

  // チャット状態
  const [messages, setMessages] = createSignal<ConversationMessage[]>([]);
  const [input, setInput] = createSignal('');
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [sending, setSending] = createSignal(false);

  // MCP状態
  const [mcps, setMcps] = createSignal<AgentMcpLink[]>([]);
  const [showMcpManager, setShowMcpManager] = createSignal(false);

  // 初期化
  onMount(async () => {
    try {
      const { user: currentUser } = await apiClient.getMe();
      setUser(currentUser);
      await loadMcps();
    } catch (err) {
      console.error('Failed to load user:', err);
      // 認証エラーの場合はログイン画面へ（今後実装）
    } finally {
      setLoading(false);
    }
  });

  // MCP一覧を読み込み
  const loadMcps = async () => {
    try {
      const { items } = await apiClient.getLinkedMcps();
      setMcps(items);
    } catch (err) {
      console.error('Failed to load MCPs:', err);
    }
  };

  // チャット送信
  const handleSend = async () => {
    const text = input().trim();
    if (!text || sending()) return;

    setSending(true);

    // ユーザーメッセージを追加
    const userMessage: ConversationMessage = {
      id: `temp-${Date.now()}`,
      sessionId: sessionId() || '',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages([...messages(), userMessage]);
    setInput('');

    try {
      const response = await apiClient.sendChat({
        sessionId: sessionId() || undefined,
        input: text,
        messages: messages(),
      });

      // レスポンスからセッションIDとメッセージを取得
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      if (response.message) {
        setMessages([...messages(), response.message]);
      }
      if (response.messages) {
        setMessages(response.messages);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(err instanceof Error ? err.message : 'メッセージの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  // MCP検索
  const handleMcpSearch = async (query: string, tags?: string[]) => {
    const response = await apiClient.searchMcps({ query, tags });
    return response.items;
  };

  // MCP追加
  const handleMcpLink = async (mcpServerId: string) => {
    await apiClient.linkMcp({ mcpServerId });
    await loadMcps();
  };

  // MCP削除
  const handleMcpUnlink = async (linkId: string) => {
    if (!confirm('このMCPサーバーを削除しますか?')) return;
    await apiClient.unlinkMcp({ linkId });
    await loadMcps();
  };

  // MCPテスト
  const handleMcpTest = async (mcpServerId: string) => {
    try {
      const result = await apiClient.testMcp({ mcpServerId });
      if (result.ok) {
        alert(`接続成功 (${result.latencyMs}ms)`);
      } else {
        alert(`接続失敗: ${result.error}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'テストに失敗しました');
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Show when={loading()}>
        <div class="flex items-center justify-center h-screen">
          <div class="text-gray-500">読み込み中...</div>
        </div>
      </Show>

      <Show when={!loading() && user()}>
        <div class="flex h-screen">
          {/* サイドバー */}
          <div class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
                AI Agent
              </h1>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {user()?.email}
              </p>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div class="mb-4">
                <button
                  class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={() => setShowMcpManager(!showMcpManager())}
                >
                  {showMcpManager() ? 'チャットに戻る' : 'MCP管理'}
                </button>
              </div>

              <Show when={!showMcpManager()}>
                <div class="space-y-2">
                  <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    セッション
                  </h2>
                  <Show when={sessionId()}>
                    <div class="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {sessionId()?.substring(0, 8)}...
                    </div>
                  </Show>
                  <button
                    class="w-full px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    onClick={() => {
                      setSessionId(null);
                      setMessages([]);
                    }}
                  >
                    新しいセッション
                  </button>
                </div>
              </Show>

              <Show when={showMcpManager()}>
                <div class="space-y-2">
                  <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    登録済みMCP ({mcps().length})
                  </h2>
                </div>
              </Show>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div class="flex-1 flex flex-col">
            <Show when={!showMcpManager()}>
              {/* チャットエリア */}
              <div class="flex-1 overflow-y-auto p-4">
                <div class="max-w-4xl mx-auto">
                  <Show
                    when={messages().length > 0}
                    fallback={
                      <div class="text-center text-gray-500 mt-20">
                        <p class="text-lg">メッセージを送信してください</p>
                        <p class="text-sm mt-2">
                          登録されたMCPツールを使用してタスクを実行できます
                        </p>
                      </div>
                    }
                  >
                    <For each={messages()}>
                      {(message) => <MessageItem message={message} />}
                    </For>
                  </Show>
                </div>
              </div>

              {/* 入力エリア */}
              <div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <div class="max-w-4xl mx-auto flex gap-2">
                  <input
                    type="text"
                    class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder="メッセージを入力..."
                    value={input()}
                    onInput={(e) => setInput(e.currentTarget.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sending() && handleSend()}
                    disabled={sending()}
                  />
                  <button
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleSend}
                    disabled={sending() || !input().trim()}
                  >
                    {sending() ? '送信中...' : '送信'}
                  </button>
                </div>
              </div>
            </Show>

            <Show when={showMcpManager()}>
              {/* MCP管理エリア */}
              <div class="flex-1 overflow-y-auto p-4">
                <div class="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                      MCP管理
                    </h2>
                    
                    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                        MCPサーバーを検索
                      </h3>
                      <McpSearch
                        onSearch={handleMcpSearch}
                        onLink={handleMcpLink}
                      />
                    </div>

                    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                        登録済みMCPサーバー
                      </h3>
                      <McpList
                        mcps={mcps()}
                        onUnlink={handleMcpUnlink}
                        onTest={handleMcpTest}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !user()}>
        <div class="flex items-center justify-center h-screen">
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              ログインが必要です
            </h1>
            <p class="text-gray-600 dark:text-gray-400">
              認証情報が見つかりません
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default App;

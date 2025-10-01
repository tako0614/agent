import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginButton } from './components/LoginButton';
import { UserProfile } from './components/UserProfile';
import { AuthProvider, useAuth } from './utils/auth';
import type { Message } from './types';

const ChatApp: Component = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [messages, setMessages] = createSignal<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'こんにちは!AIエージェントです。予約システム、ECサイト、フォームなど、様々なサービスの作成や操作をお手伝いします。何をしたいですか?',
      createdAt: new Date().toISOString()
    }
  ]);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    console.log('[ChatApp] Effect triggered, isLoading:', isLoading(), 'isAuthenticated:', isAuthenticated());
  });

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };

    setMessages([...messages(), userMessage]);
    setLoading(true);

    try {
      // Get conversation history for context
      const history = messages()
        .slice(-10) // Last 10 messages for context
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/conversations/demo/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include auth cookies
        body: JSON.stringify({
          content: text,
          history
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json() as {
        id: string;
        content: string;
        createdAt: string;
        toolCall?: { name: string; params: any };
        toolResult?: any;
      };

      let assistantContent = data.content;
      
      // If there was a tool call, add context about it
      if (data.toolCall && data.toolResult) {
        assistantContent = `${data.content}\n\n*ツール「${data.toolCall.name}」を実行しました。*`;
      }

      const assistantMessage: Message = {
        id: data.id,
        role: 'assistant',
        content: assistantContent,
        createdAt: data.createdAt
      };

      setMessages([...messages(), assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: '申し訳ありません。エラーが発生しました。もう一度お試しください。',
        createdAt: new Date().toISOString()
      };
      setMessages([...messages(), errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="flex items-center justify-center h-screen bg-gray-50">
          <LoadingSpinner size={40} />
        </div>
      }
    >
      <Show
        when={isAuthenticated()}
        fallback={<LoginButton />}
      >
        <div class="flex flex-col h-screen bg-gray-50">
          {/* Header */}
          <header class="bg-white border-b border-gray-200">
            <UserProfile />
            <div class="px-6 py-4">
              <h1 class="text-2xl font-bold text-gray-900">AI Service Builder</h1>
              <p class="text-sm text-gray-600">AIでネットサービスを簡単に作成・操作</p>
            </div>
          </header>

          {/* Messages */}
          <main class="flex-1 overflow-y-auto px-6 py-4">
            <div class="max-w-3xl mx-auto space-y-4">
              <For each={messages()}>
                {(message) => (
                  <MessageBubble
                    role={message.role}
                    content={message.content}
                    timestamp={message.createdAt}
                  />
                )}
              </For>
              <Show when={loading()}>
                <div class="flex justify-start">
                  <div class="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <LoadingSpinner size={20} />
                  </div>
                </div>
              </Show>
            </div>
          </main>

          {/* Input */}
          <footer class="bg-white border-t border-gray-200 px-6 py-4">
            <div class="max-w-3xl mx-auto">
              <ChatInput
                onSend={handleSendMessage}
                disabled={loading()}
              />
            </div>
          </footer>
        </div>
      </Show>
    </Show>
  );
};

const App: Component = () => {
  return (
    <AuthProvider>
      <ChatApp />
    </AuthProvider>
  );
};

export default App;
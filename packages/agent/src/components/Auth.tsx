/**
 * OAuth認証フローを管理するコンポーネント
 */

import { type Component, createSignal, onMount } from 'solid-js';
import { OAuthManager } from '../lib/oauth';

interface AuthCallbackProps {
  onSuccess: () => void;
}

export const AuthCallback: Component<AuthCallbackProps> = (props) => {
  const [error, setError] = createSignal<string | null>(null);
  const [processing, setProcessing] = createSignal(true);

  onMount(async () => {
    try {
      // OAuth設定（環境変数から取得する想定）
      const config = {
        tokenEndpoint: import.meta.env.VITE_OAUTH_TOKEN_ENDPOINT || 'http://localhost:8788/auth/token',
        clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || 'agent-client',
        redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      };

      await OAuthManager.handleCallback(config);
      props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証に失敗しました');
    } finally {
      setProcessing(false);
    }
  });

  return (
    <div class="flex items-center justify-center h-screen">
      {processing() ? (
        <div class="text-center">
          <div class="text-xl text-gray-600 dark:text-gray-400">
            認証処理中...
          </div>
        </div>
      ) : error() ? (
        <div class="text-center">
          <div class="text-xl text-red-600 dark:text-red-400 mb-4">
            認証エラー
          </div>
          <div class="text-gray-600 dark:text-gray-400">{error()}</div>
          <button
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={() => window.location.href = '/'}
          >
            トップへ戻る
          </button>
        </div>
      ) : null}
    </div>
  );
};

interface LoginButtonProps {
  class?: string;
}

export const LoginButton: Component<LoginButtonProps> = (props) => {
  const handleLogin = async () => {
    try {
      // OAuth設定（環境変数から取得する想定）
      const config = {
        authEndpoint: import.meta.env.VITE_OAUTH_AUTH_ENDPOINT || 'http://localhost:8788/auth/authorize',
        clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || 'agent-client',
        redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
        scope: 'agent.session.manage mcp.discovery.read',
      };

      await OAuthManager.startAuthFlow(config);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ログインに失敗しました');
    }
  };

  return (
    <button
      class={props.class || 'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
      onClick={handleLogin}
    >
      ログイン
    </button>
  );
};

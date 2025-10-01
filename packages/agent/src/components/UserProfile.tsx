import { Component, Show } from 'solid-js';
import { useAuth } from '../utils/auth';

export const UserProfile: Component = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <Show when={isAuthenticated()}>
      <div class="flex items-center gap-3 p-4 border-b border-gray-200">
        <Show when={user()?.picture}>
          <img 
            src={user()?.picture} 
            alt={user()?.name} 
            class="w-10 h-10 rounded-full"
          />
        </Show>
        <div class="flex-1">
          <p class="font-medium text-gray-900">{user()?.name}</p>
          <p class="text-sm text-gray-500">{user()?.email}</p>
        </div>
        <button
          onClick={logout}
          class="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        >
          ログアウト
        </button>
      </div>
    </Show>
  );
};

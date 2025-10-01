import { createContext, useContext, createSignal, onMount, ParentComponent } from 'solid-js';

type User = {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'line';
};

type AuthContextType = {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  login: (provider: 'google' | 'line') => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);

  console.log('[Auth] Provider initialized, isLoading:', isLoading());

  const checkAuth = async () => {
    console.log('[Auth] Checking authentication status... isLoading before:', isLoading());
    try {
      const response = await fetch('/auth/status', {
        credentials: 'include'
      });
      
      console.log('[Auth] Status response:', response.status, response.ok);
      
      if (!response.ok) {
        console.warn('[Auth] Status check failed with status:', response.status);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json() as { authenticated: boolean; userId?: string };
      console.log('[Auth] Status data:', data);
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        // Get user info
        const userResponse = await fetch('/auth/me', {
          credentials: 'include'
        });
        if (userResponse.ok) {
          const userData = await userResponse.json() as User;
          console.log('[Auth] User data loaded:', userData);
          setUser(userData);
        } else {
          console.warn('[Auth] Failed to fetch user info:', userResponse.status);
        }
      } else {
        console.log('[Auth] User not authenticated');
      }
    } catch (error) {
      console.error('[Auth] Failed to check auth status:', error);
    } finally {
      console.log('[Auth] Loading complete, setting isLoading to false');
      setIsLoading(false);
      console.log('[Auth] isLoading after setIsLoading(false):', isLoading());
    }
  };

  onMount(() => {
    console.log('[Auth] onMount called');
    
    // Check for login status from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'success') {
      console.log('[Auth] Login success detected');
      checkAuth();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('login') === 'error') {
      console.error('[Auth] Login failed');
      setIsLoading(false);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // Normal auth check
      checkAuth();
    }
  });

  const login = (provider: 'google' | 'line') => {
    window.location.href = `/auth/login/${provider}`;
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading,
      login, 
      logout,
      checkAuth 
    }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

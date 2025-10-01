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

  const checkAuth = async () => {
    try {
      const response = await fetch('/auth/status', {
        credentials: 'include'
      });
      const data = await response.json() as { authenticated: boolean; userId?: string };
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        // Get user info
        const userResponse = await fetch('/auth/me', {
          credentials: 'include'
        });
        if (userResponse.ok) {
          const userData = await userResponse.json() as User;
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    checkAuth();
    
    // Check for login status from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'success') {
      checkAuth();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('login') === 'error') {
      console.error('Login failed');
      window.history.replaceState({}, '', window.location.pathname);
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

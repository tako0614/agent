import { Google, Line } from 'arctic';

export interface OAuthProvider {
  createAuthorizationURL(state: string): Promise<URL>;
  validateAuthorizationCode(code: string): Promise<any>;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'line' | 'email';
}

export class AuthService {
  private google: Google | null = null;
  private line: Line | null = null;

  constructor(config: {
    googleClientId?: string;
    googleClientSecret?: string;
    googleRedirectUri?: string;
    lineClientId?: string;
    lineClientSecret?: string;
    lineRedirectUri?: string;
  }) {
    // Initialize Google OAuth
    if (config.googleClientId && config.googleClientSecret && config.googleRedirectUri) {
      this.google = new Google(
        config.googleClientId,
        config.googleClientSecret,
        config.googleRedirectUri
      );
    }

    // Initialize LINE OAuth
    if (config.lineClientId && config.lineClientSecret && config.lineRedirectUri) {
      this.line = new Line(
        config.lineClientId,
        config.lineClientSecret,
        config.lineRedirectUri
      );
    }
  }

  /**
   * Generate authorization URL for Google
   */
  async createGoogleAuthorizationURL(state: string, codeVerifier: string): Promise<URL> {
    if (!this.google) {
      throw new Error('Google OAuth is not configured');
    }

    const scopes = ['openid', 'profile', 'email'];
    return await this.google.createAuthorizationURL(state, codeVerifier, scopes);
  }

  /**
   * Generate authorization URL for LINE
   */
  async createLINEAuthorizationURL(state: string, codeVerifier: string): Promise<URL> {
    if (!this.line) {
      throw new Error('LINE OAuth is not configured');
    }

    const scopes = ['profile', 'openid', 'email'];
    return await this.line.createAuthorizationURL(state, codeVerifier, scopes);
  }

  /**
   * Validate Google authorization code and get user info
   */
  async validateGoogleCode(code: string, codeVerifier: string): Promise<UserInfo> {
    if (!this.google) {
      throw new Error('Google OAuth is not configured');
    }

    const tokens = await this.google.validateAuthorizationCode(code, codeVerifier);
    
    // Get user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const googleUser = await response.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    return {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: 'google'
    };
  }

  /**
   * Validate LINE authorization code and get user info
   */
  async validateLINECode(code: string, codeVerifier: string): Promise<UserInfo> {
    if (!this.line) {
      throw new Error('LINE OAuth is not configured');
    }

    const tokens = await this.line.validateAuthorizationCode(code, codeVerifier);
    
    // Get user info from LINE
    const response = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from LINE');
    }

    const lineUser = await response.json() as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    // LINE doesn't provide email in profile API, need to use id token
    let email = '';
    const idToken = tokens.idToken();
    if (idToken) {
      try {
        // Decode ID token to get email
        const payload = JSON.parse(
          atob(idToken.split('.')[1])
        );
        email = payload.email || '';
      } catch (e) {
        console.error('Failed to decode LINE ID token:', e);
      }
    }

    return {
      id: lineUser.userId,
      email,
      name: lineUser.displayName,
      picture: lineUser.pictureUrl,
      provider: 'line'
    };
  }

  /**
   * Generate a random state for OAuth
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a code verifier for PKCE
   */
  generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a session token
   */
  createSessionToken(userInfo: UserInfo): string {
    const payload = {
      userId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: userInfo.provider,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    return btoa(JSON.stringify(payload));
  }

  /**
   * Validate session token
   */
  validateSessionToken(token: string): UserInfo | null {
    try {
      const payload = JSON.parse(atob(token));
      
      if (payload.exp < Date.now()) {
        return null; // Token expired
      }

      return {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: payload.provider
      };
    } catch {
      return null;
    }
  }
}

export function createAuthService(config: {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  lineClientId?: string;
  lineClientSecret?: string;
  lineRedirectUri?: string;
}): AuthService {
  return new AuthService(config);
}

/**
 * Authentication Service for Agent App
 * Uses MCP Server OAuth 2.1 for authentication
 */

import { OAuthClient } from './oauth-client';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce';
import { 
  storeTokens, 
  getTokens, 
  clearTokens, 
  storeCodeVerifier, 
  getAndDeleteCodeVerifier,
  storeState,
  getAndDeleteState,
  TokenSet 
} from './token-manager';
import { Context } from 'hono';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthServiceConfig {
  mcpServerUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope?: string[];
}

export class AuthService {
  private oauthClient: OAuthClient;
  private config: AuthServiceConfig;

  constructor(config: AuthServiceConfig) {
    this.config = config;
    this.oauthClient = new OAuthClient({
      authorizationEndpoint: `${config.mcpServerUrl}/oauth/authorize`,
      tokenEndpoint: `${config.mcpServerUrl}/oauth/token`,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scope: config.scope,
    });
  }

  /**
   * Start OAuth 2.1 authorization flow
   * Returns authorization URL to redirect user to
   */
  async startAuthorizationFlow(c: Context): Promise<URL> {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store PKCE parameters in cookies
    storeCodeVerifier(c, codeVerifier);
    storeState(c, state);

    // Build authorization URL
    return this.oauthClient.buildAuthorizationUrl(
      codeChallenge,
      state,
      this.config.scope
    );
  }

  /**
   * Handle OAuth callback
   * Exchange authorization code for tokens
   */
  async handleCallback(
    c: Context,
    code: string,
    state: string
  ): Promise<TokenSet> {
    // Verify state parameter (CSRF protection)
    const storedState = getAndDeleteState(c);
    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter');
    }

    // Get code verifier
    const codeVerifier = getAndDeleteCodeVerifier(c);
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    // Exchange code for tokens
    const tokens = await this.oauthClient.exchangeCode(code, codeVerifier);

    // Store tokens in cookies
    storeTokens(c, tokens);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ? tokens.scope.split(' ') : undefined,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(c: Context): Promise<TokenSet> {
    const tokens = getTokens(c);
    if (!tokens || !tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const newTokens = await this.oauthClient.refreshToken(tokens.refreshToken);

    // Store new tokens
    storeTokens(c, newTokens);

    return {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: Date.now() + newTokens.expires_in * 1000,
      scope: newTokens.scope ? newTokens.scope.split(' ') : undefined,
    };
  }

  /**
   * Get current tokens
   */
  getTokens(c: Context): TokenSet | null {
    return getTokens(c);
  }

  /**
   * Logout user
   */
  logout(c: Context): void {
    clearTokens(c);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(c: Context): boolean {
    const tokens = getTokens(c);
    return tokens !== null && Date.now() < tokens.expiresAt;
  }
}

/**
 * Create auth service from environment variables
 */
export function createAuthService(env: {
  MCP_SERVER_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI: string;
  OAUTH_SCOPE?: string;
}): AuthService {
  return new AuthService({
    mcpServerUrl: env.MCP_SERVER_URL,
    clientId: env.OAUTH_CLIENT_ID,
    clientSecret: env.OAUTH_CLIENT_SECRET,
    redirectUri: env.OAUTH_REDIRECT_URI,
    scope: env.OAUTH_SCOPE ? env.OAUTH_SCOPE.split(' ') : undefined,
  });
}

// Export all auth utilities
export * from './oauth-client';
export * from './pkce';
export * from './token-manager';


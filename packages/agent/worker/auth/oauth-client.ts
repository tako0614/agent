/**
 * OAuth 2.1 Client Implementation
 * Handles OAuth 2.1 Authorization Code + PKCE flow with MCP Server
 */

export interface OAuthClientConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string; // Optional for public clients
  redirectUri: string;
  scope?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class OAuthClient {
  private config: OAuthClientConfig;

  constructor(config: OAuthClientConfig) {
    this.config = config;
  }

  /**
   * Build authorization URL with PKCE
   */
  buildAuthorizationUrl(
    codeChallenge: string,
    state: string,
    scope?: string[]
  ): URL {
    const url = new URL(this.config.authorizationEndpoint);
    
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    
    const scopeStr = (scope || this.config.scope || []).join(' ');
    if (scopeStr) {
      url.searchParams.set('scope', scopeStr);
    }

    return url;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
    });

    // Add client secret if available (for confidential clients)
    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}) as any);
      throw new Error(
        `Token exchange failed: ${(error as any).error_description || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    // Add client secret if available (for confidential clients)
    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}) as any);
      throw new Error(
        `Token refresh failed: ${(error as any).error_description || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Revoke token (if supported by authorization server)
   */
  async revokeToken(_token: string, _tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    // MCP Server doesn't implement revocation endpoint yet
    // This is a placeholder for future implementation
    console.warn('Token revocation not implemented yet');
  }
}

/**
 * Create OAuth client from environment variables
 */
export function createOAuthClient(env: {
  MCP_SERVER_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI: string;
  OAUTH_SCOPE?: string;
}): OAuthClient {
  return new OAuthClient({
    authorizationEndpoint: `${env.MCP_SERVER_URL}/oauth/authorize`,
    tokenEndpoint: `${env.MCP_SERVER_URL}/oauth/token`,
    clientId: env.OAUTH_CLIENT_ID,
    clientSecret: env.OAUTH_CLIENT_SECRET,
    redirectUri: env.OAUTH_REDIRECT_URI,
    scope: env.OAUTH_SCOPE ? env.OAUTH_SCOPE.split(' ') : undefined,
  });
}

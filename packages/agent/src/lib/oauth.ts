/**
 * OAuth 2.1 PKCE フロー実装
 * DETAILED_SPEC.md セクション4に基づく
 */

/**
 * ランダムな文字列を生成（code_verifier用）
 */
function generateRandomString(length: number): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((v) => possible[v % possible.length])
    .join('');
}

/**
 * SHA-256ハッシュを計算し、Base64URL形式に変換
 */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

/**
 * ArrayBufferをBase64URL形式にエンコード
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * PKCE パラメータを生成
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/**
 * OAuth認可リクエストURLを構築
 */
export function buildAuthorizeUrl(params: {
  authEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(params.authEndpoint);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

/**
 * 認可コードからトークンを取得
 */
export async function exchangeCodeForToken(params: {
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(params.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'token_exchange_failed',
    })) as { error: string; error_description?: string };
    throw new Error(error.error_description || error.error);
  }

  return response.json();
}

/**
 * OAuth状態を管理するクラス
 */
export class OAuthManager {
  private static readonly STATE_KEY = 'oauth_state';
  private static readonly VERIFIER_KEY = 'oauth_code_verifier';

  /**
   * OAuth認可フローを開始
   */
  static async startAuthFlow(params: {
    authEndpoint: string;
    clientId: string;
    redirectUri: string;
    scope: string;
  }): Promise<void> {
    const state = generateRandomString(32);
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // 状態をsessionStorageに保存
    sessionStorage.setItem(this.STATE_KEY, state);
    sessionStorage.setItem(this.VERIFIER_KEY, codeVerifier);

    const authUrl = buildAuthorizeUrl({
      authEndpoint: params.authEndpoint,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      codeChallenge,
      state,
    });

    // リダイレクト
    window.location.href = authUrl;
  }

  /**
   * リダイレクト後のコールバックを処理
   */
  static async handleCallback(params: {
    tokenEndpoint: string;
    clientId: string;
    redirectUri: string;
  }): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // 状態を検証
    const savedState = sessionStorage.getItem(this.STATE_KEY);
    if (state !== savedState) {
      throw new Error('State mismatch');
    }

    const codeVerifier = sessionStorage.getItem(this.VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('Missing code verifier');
    }

    // トークン交換
    const token = await exchangeCodeForToken({
      tokenEndpoint: params.tokenEndpoint,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      code,
      codeVerifier,
    });

    // クリーンアップ
    sessionStorage.removeItem(this.STATE_KEY);
    sessionStorage.removeItem(this.VERIFIER_KEY);

    return token;
  }
}

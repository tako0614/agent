/// <reference types="vite/client" />

interface ImportMetaEnv {
  // OAuth設定
  readonly VITE_OAUTH_AUTH_ENDPOINT?: string;
  readonly VITE_OAUTH_TOKEN_ENDPOINT?: string;
  readonly VITE_OAUTH_CLIENT_ID?: string;
  readonly VITE_OAUTH_REDIRECT_URI?: string;
  
  // API設定
  readonly VITE_API_BASE_URL?: string;
  
  // その他
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  readonly VITE_GOOGLE_AUTH_CLIENT_ID?: string;
  readonly VITE_XRD_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

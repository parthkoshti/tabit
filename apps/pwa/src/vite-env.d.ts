/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PWA_URL?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_DONATE_URL?: string;
  readonly VITE_QUERY_CACHE_BUSTER?: string;
  readonly VITE_NOTIFICATIONS_WS_URL?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

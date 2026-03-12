/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_PWA_URL?: string;
  readonly NEXT_PUBLIC_DONATE_URL?: string;
  readonly VITE_QUERY_CACHE_BUSTER?: string;
  readonly VITE_NOTIFICATIONS_WS_URL?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

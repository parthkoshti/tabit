/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_PWA_URL?: string;
  readonly NEXT_PUBLIC_DONATE_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_QUERY_CACHE_BUSTER?: string;
  readonly VITE_NOTIFICATIONS_WS_URL?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

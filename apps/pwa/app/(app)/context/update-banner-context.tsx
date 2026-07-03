import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const SW_JUST_UPDATED_KEY = "tab-sw-just-updated";

type UpdateBannerContextValue = {
  needRefresh: boolean;
  applyUpdate: () => Promise<void>;
};

const UpdateBannerContext = createContext<UpdateBannerContextValue | null>(null);

export function UpdateBannerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cleanupRef = useRef<(() => void) | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      cleanupRef.current?.();

      if (!registration) return;

      if (sessionStorage.getItem(SW_JUST_UPDATED_KEY)) {
        sessionStorage.removeItem(SW_JUST_UPDATED_KEY);
        return;
      }

      async function checkForUpdate() {
        if (
          registration.installing ||
          registration.waiting ||
          !navigator.onLine
        ) {
          return;
        }
        try {
          const resp = await fetch(swUrl, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          });
          if (resp?.status === 200) await registration.update();
        } catch {
          // ignore
        }
      }

      const initialTimer = window.setTimeout(checkForUpdate, 3_000);

      const onVisible = () => {
        if (document.visibilityState === "visible") checkForUpdate();
      };
      document.addEventListener("visibilitychange", onVisible);

      const interval = window.setInterval(checkForUpdate, 15 * 60 * 1000);

      cleanupRef.current = () => {
        window.clearTimeout(initialTimer);
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },
  });

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const applyUpdate = useCallback(async () => {
    sessionStorage.setItem(SW_JUST_UPDATED_KEY, "1");
    setNeedRefresh(false);

    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reload, {
      once: true,
    });

    await updateServiceWorker(true);

    // Fallback when skipWaiting does not take control (e.g. stale cached sw.js)
    window.setTimeout(reload, 3_000);
  }, [setNeedRefresh, updateServiceWorker]);

  return (
    <UpdateBannerContext.Provider value={{ needRefresh, applyUpdate }}>
      {children}
    </UpdateBannerContext.Provider>
  );
}

export function useUpdateBanner() {
  const ctx = useContext(UpdateBannerContext);
  if (!ctx) {
    return {
      needRefresh: false,
      applyUpdate: async () => {},
    };
  }
  return ctx;
}

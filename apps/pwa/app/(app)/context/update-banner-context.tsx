import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useVersionCheck } from "@/lib/use-version-check";

const DISMISSED_VERSION_KEY = "dismissed-update-version";

// TODO: Remove - temporarily force banner to show for testing
const TEMP_FORCE_HAS_UPDATE = false;

type UpdateBannerContextValue = {
  showBanner: boolean;
  hasUpdate: boolean;
  latestVersion: string | null;
  currentVersion: string;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => void;
  dismiss: () => void;
};

const UpdateBannerContext = createContext<UpdateBannerContextValue | null>(
  null,
);

export function UpdateBannerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hasUpdate, latestVersion, currentVersion } = useVersionCheck();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(
        async () => {
          if (registration.installing || !navigator.onLine) return;
          try {
            const resp = await fetch(swUrl, {
              cache: "no-store",
              headers: { "Cache-Control": "no-cache" },
            });
            if (resp?.status === 200) await registration.update();
          } catch {
            // ignore
          }
        },
        15 * 60 * 1000,
      );
    },
  });

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (
      latestVersion &&
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISSED_VERSION_KEY) === latestVersion
    ) {
      setDismissed(true);
    }
  }, [latestVersion]);

  const dismiss = useCallback(() => {
    if (latestVersion) {
      sessionStorage.setItem(DISMISSED_VERSION_KEY, latestVersion);
    }
    setDismissed(true);
  }, [latestVersion]);

  const showBanner = (TEMP_FORCE_HAS_UPDATE ? true : hasUpdate) && !dismissed;

  const value: UpdateBannerContextValue = {
    showBanner,
    hasUpdate,
    latestVersion,
    currentVersion,
    needRefresh,
    updateServiceWorker,
    dismiss,
  };

  return (
    <UpdateBannerContext.Provider value={value}>
      {children}
    </UpdateBannerContext.Provider>
  );
}

export function useUpdateBanner() {
  const ctx = useContext(UpdateBannerContext);
  if (!ctx) {
    return {
      showBanner: false,
      hasUpdate: false,
      latestVersion: null,
      currentVersion: __APP_VERSION__,
      needRefresh: false,
      updateServiceWorker: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}

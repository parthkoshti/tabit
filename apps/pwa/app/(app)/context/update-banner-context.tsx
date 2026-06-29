import { createContext, useContext } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type UpdateBannerContextValue = {
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => void;
};

const UpdateBannerContext = createContext<UpdateBannerContextValue | null>(null);

export function UpdateBannerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      async function checkForUpdate() {
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
      }

      checkForUpdate();

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });

      setInterval(checkForUpdate, 15 * 60 * 1000);
    },
  });

  return (
    <UpdateBannerContext.Provider value={{ needRefresh, updateServiceWorker }}>
      {children}
    </UpdateBannerContext.Provider>
  );
}

export function useUpdateBanner() {
  const ctx = useContext(UpdateBannerContext);
  if (!ctx) {
    return {
      needRefresh: false,
      updateServiceWorker: () => {},
    };
  }
  return ctx;
}

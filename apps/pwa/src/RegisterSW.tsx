import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((reg) => {
          reg.update();
          if (import.meta.env.DEV) {
            console.log("[SW] Checking for service worker update");
          }
        });
    }
  }, []);

  return null;
}

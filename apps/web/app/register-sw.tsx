"use client";

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
          if (process.env.NODE_ENV === "development") {
            console.log("[SW] Checking for service worker update");
          }
        });
    }
  }, []);

  return null;
}

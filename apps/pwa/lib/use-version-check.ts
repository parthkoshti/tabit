import { useEffect, useState } from "react";

type ChangelogData =
  | { releases: { version: string }[] }
  | { content: string };

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch("/changelog.json", { cache: "no-store" });
        const data = (await res.json()) as ChangelogData;

        if ("releases" in data && Array.isArray(data.releases)) {
          const latest = data.releases[0]?.version;
          if (latest) {
            setLatestVersion(latest);
            if (latest !== __APP_VERSION__) {
              setHasUpdate(true);

              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.getRegistration();
                registration?.update();
              }
            }
          }
        }
      } catch {
        // Offline or fetch failed; no banner
      }
    }

    checkVersion();

    const interval = setInterval(checkVersion, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    hasUpdate,
    latestVersion,
    currentVersion: __APP_VERSION__,
  };
}

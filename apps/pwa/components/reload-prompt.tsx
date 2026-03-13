import { useRegisterSW } from "virtual:pwa-register/react";

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 z-50 mx-auto max-w-md rounded-lg border border-border bg-card p-4 shadow-lg sm:left-auto">
      <p className="mb-3 text-sm text-foreground">
        {offlineReady
          ? "App ready to work offline"
          : "New content available, click reload to update."}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium"
          onClick={close}
        >
          {needRefresh ? "Later" : "OK"}
        </button>
      </div>
    </div>
  );
}

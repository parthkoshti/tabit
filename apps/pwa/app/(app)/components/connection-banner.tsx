import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, Loader2 } from "lucide-react";
import type { ConnectionState } from "@/lib/notification-manager";

type ConnectionBannerProps = {
  connectionState: ConnectionState;
};

export function ConnectionBanner({ connectionState }: ConnectionBannerProps) {
  const show =
    connectionState === "disconnected" || connectionState === "reconnecting";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] text-amber-600 dark:text-amber-400"
          role="status"
          aria-live="polite"
        >
          {connectionState === "reconnecting" ? (
            <>
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin"
                aria-hidden
              />
              <span className="text-sm font-medium">
                Reconnecting to server...
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium">You are offline</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

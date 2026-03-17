import { useDeferredValue } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { createStore, clear } from "idb-keyval";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fabSpring } from "@/lib/animations";
import { useQueryClient } from "@tanstack/react-query";

function isFabVisible(pathname: string): boolean {
  if (pathname === "/expense/new") return false;
  if (pathname === "/friends") return true;
  if (pathname === "/tabs") return true;
  if (pathname === "/activity") return true;
  if (/^\/tabs\/[^/]+$/.test(pathname)) return true;
  return false;
}

type AddExpenseFABProps = {
  placement?: "floating" | "navbar";
};

export function AddExpenseFAB({ placement = "floating" }: AddExpenseFABProps) {
  const { pathname } = useLocation();
  const deferredPathname = useDeferredValue(pathname);
  const params = useParams<{ tabId?: string }>();
  const tabIdFromParams = params?.tabId;
  const queryClient = useQueryClient();

  const bustCache = async () => {
    queryClient.clear();
    const idbStore = createStore("tabit-query-cache", "queries");
    await clear(idbStore);
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    localStorage.clear();
    window.location.reload();
  };

  const expenseNewHref = tabIdFromParams
    ? `/expense/new?tabId=${tabIdFromParams}`
    : "/expense/new";

  const fabButton = (
    <motion.div {...fabSpring} whileTap={{ scale: 0.95 }}>
      <Button
        variant="default"
        className={
          placement === "navbar"
            ? "size-18 rounded-full border border-border/40 p-0 shadow-md ring-2 ring-background transition-all duration-200 hover:shadow-lg [&_svg]:size-7"
            : "h-12 gap-2 rounded-full px-4 shadow-lg"
        }
        asChild
      >
        <Link to={expenseNewHref}>
          <Plus />
          {placement === "floating" && "Add Expense"}
        </Link>
      </Button>
    </motion.div>
  );

  if (placement === "floating" && !isFabVisible(deferredPathname)) return null;

  return (
    <>
      {placement === "navbar" ? (
        <>
          {import.meta.env.DEV && (
            <div className="fixed bottom-28 right-4 z-30">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground"
                onClick={bustCache}
                title="Bust query cache"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex flex-1 items-center justify-center px-1">
            <div className="">{fabButton}</div>
          </div>
        </>
      ) : (
        <div className="fixed bottom-28 right-4 z-30 flex flex-col items-end gap-2">
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground"
              onClick={bustCache}
              title="Bust query cache"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {isFabVisible(deferredPathname) && fabButton}
        </div>
      )}
    </>
  );
}

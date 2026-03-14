import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowLeft,
  Plus,
  ReceiptText,
  Download,
  CircleFadingArrowUp,
  Settings,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { appConfig } from "@/src/config";
import { useNavTitleConfig } from "../context/nav-title-context";
import { useNavStore } from "@/lib/stores/nav-store";
import { SignOutButton } from "./sign-out-button";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { UpdateDialog } from "@/components/update-dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { transitionSpring } from "@/lib/animations";

const navTitleVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

export function TopNavbar() {
  const { pathname } = useLocation();
  const displayPathname = useNavStore((s) => s.displayPathname) || pathname;
  const navigate = useNavigate();
  const navPage = useNavTitleConfig();
  const isMePage = displayPathname === "/me";
  const isFriendsListPage =
    displayPathname === "/friends" || displayPathname === "/friends/";
  const isTabsListPage =
    displayPathname === "/tabs" || displayPathname === "/tabs/";
  const isTabPage =
    displayPathname.startsWith("/tabs/") &&
    !displayPathname.match(/^\/tabs\/?$/);
  const isMainTabPage = /^\/tabs\/[^/]+$/.test(displayPathname);
  const mainTabId = isMainTabPage
    ? displayPathname.replace(/^\/tabs\//, "").split("/")[0]
    : null;
  const isActivityPage = displayPathname === "/activity";
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
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

  return (
    <header className="top-nav-safe fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top,0px)]">
      {navPage ? (
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 shrink-0"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="absolute left-0 right-0 flex items-center justify-center gap-2 px-14 pointer-events-none">
            <div className="flex items-center justify-center gap-2 min-w-0 pointer-events-auto overflow-hidden">
              {navPage.icon ? (
                <span className="shrink-0">{navPage.icon}</span>
              ) : isTabPage ? (
                <ReceiptText className="h-5 w-5 shrink-0 text-tab-icon" />
              ) : null}
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={navPage.title}
                  className="truncate text-lg font-semibold"
                  variants={navTitleVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitionSpring.transition}
                >
                  {navPage.title}
                </motion.h1>
              </AnimatePresence>
              {isTabPage &&
                navPage.avatarUserIds &&
                navPage.avatarUserIds.length > 0 && (
                  <div className="flex -space-x-2 shrink-0 items-center">
                    {navPage.avatarUserIds.slice(0, 2).map((userId) => (
                      <UserAvatar
                        key={userId}
                        userId={userId}
                        size="xs"
                        className="ring-2 ring-background"
                      />
                    ))}
                    {navPage.avatarUserIds.length > 3 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
                        3+
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 justify-end w-20 gap-1">
            {needRefresh && (
              <Button
                variant="default"
                size="sm"
                aria-label="Update app"
                onClick={() => setUpdateDialogOpen(true)}
              >
                <Download className="h-5 w-5" />
                <span>Update</span>
              </Button>
            )}
            {isMainTabPage && mainTabId && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Manage tab"
                asChild
              >
                <Link to={`/tabs/${mainTabId}/manage`}>
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between w-full">
          <Link to="/tabs" className="flex items-center gap-2">
            <img
              src={appConfig.icons.sm.src}
              alt="Tab It Logo"
              width={52}
              height={52}
            />
          </Link>
        </div>
      )}
      {!navPage &&
        (needRefresh ? (
          <div className="relative z-10 flex shrink-0 justify-end">
            <Button
              variant="default"
              size="sm"
              aria-label="Update app"
              onClick={() => setUpdateDialogOpen(true)}
            >
              <Download className="h-5 w-5" />
              <span>Update</span>
            </Button>
          </div>
        ) : isMePage ? (
          <div className="relative z-10 flex shrink-0 justify-end">
            <SignOutButton />
          </div>
        ) : isFriendsListPage ? (
          <div className="relative z-10 flex shrink-0 justify-end">
            <Button variant="default" size="sm" asChild aria-label="Add friend">
              <Link to="/friends/addFriend" className="">
                <Plus className="h-5 w-5" />
                <span>Friend</span>
              </Link>
            </Button>
          </div>
        ) : isTabsListPage ? (
          <div className="relative z-10 flex shrink-0 justify-end">
            <Button variant="default" size="sm" asChild aria-label="New tab">
              <Link to="/tabs/create" className="">
                <Plus className="h-5 w-5" />
                <span>Tab</span>
              </Link>
            </Button>
          </div>
        ) : isActivityPage ? (
          <div className="relative z-10 flex shrink-0 justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Changelog"
              onClick={() => setChangelogOpen(true)}
            >
              <CircleFadingArrowUp className="h-5 w-5" />
            </Button>
            <ChangelogDialog
              open={changelogOpen}
              onOpenChange={setChangelogOpen}
            />
          </div>
        ) : null)}
      {navPage && isMePage && (
        <div className="relative z-10 ml-auto flex shrink-0 justify-end">
          <SignOutButton />
        </div>
      )}
      {needRefresh && (
        <UpdateDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          onUpdate={() => updateServiceWorker(true)}
        />
      )}
    </header>
  );
}

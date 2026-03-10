"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { appConfig } from "@/app/config";
import { useNavTitleConfig } from "../context/nav-title-context";
import { SignOutButton } from "./sign-out-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { transitionSpring } from "@/lib/animations";

const navTitleVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

const navContentVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const navPage = useNavTitleConfig();
  const isMePage = pathname === "/me";
  const isFriendsListPage =
    pathname === "/friends" || pathname === "/friends/";
  const isTabsListPage = pathname === "/tabs" || pathname === "/tabs/";
  const isTabPage =
    pathname.startsWith("/tabs/") && !pathname.match(/^\/tabs\/?$/);

  return (
    <header className="top-nav-safe fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top,0px)]">
      <AnimatePresence mode="wait" initial={false}>
        {navPage ? (
          <motion.div
            key="navPage"
            className="absolute inset-0 flex items-center justify-between px-4"
            variants={navContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitionSpring.transition}
          >
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 shrink-0"
              aria-label="Go back"
              onClick={() => router.back()}
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
            <div className="relative z-10 flex shrink-0 justify-end w-20" />
          </motion.div>
        ) : (
          <motion.div
            key="default"
            className="flex flex-1 items-center justify-between w-full"
            variants={navContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitionSpring.transition}
          >
            <Link href="/tabs" className="flex items-center gap-2">
              <Image
                src={appConfig.icons.sm.src}
                alt="Tab It Logo"
                width={52}
                height={52}
                className=""
              />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        {!navPage && (isMePage ? (
          <motion.div
            key="signout"
            className="relative z-10 flex shrink-0 justify-end"
            variants={navTitleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitionSpring.transition}
          >
            <SignOutButton />
          </motion.div>
        ) : isFriendsListPage ? (
          <motion.div
            key="addFriend"
            className="relative z-10 flex shrink-0 justify-end"
            variants={navTitleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitionSpring.transition}
          >
            <Button variant="default" size="sm" asChild aria-label="Add friend">
              <Link href="/friends/addFriend" className="">
                <Plus className="h-5 w-5" />
                <span>Friend</span>
              </Link>
            </Button>
          </motion.div>
        ) : isTabsListPage ? (
          <motion.div
            key="newTab"
            className="relative z-10 flex shrink-0 justify-end"
            variants={navTitleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitionSpring.transition}
          >
            <Button variant="default" size="sm" asChild aria-label="New tab">
              <Link href="/tabs/create" className="">
                <Plus className="h-5 w-5" />
                <span>Tab</span>
              </Link>
            </Button>
          </motion.div>
        ) : null)}
      </AnimatePresence>
      {navPage && (
        <AnimatePresence mode="wait" initial={false}>
          {isMePage && (
            <motion.div
              key="navSignout"
              className="relative z-10 ml-auto flex shrink-0 justify-end"
              variants={navTitleVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionSpring.transition}
            >
              <SignOutButton />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </header>
  );
}

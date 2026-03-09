"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { appConfig } from "@/app/config";
import { useNavTitleConfig } from "../context/nav-title-context";
import { SignOutButton } from "./sign-out-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

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
    <header
      className="top-nav-safe fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top,0px)]"
      style={{ viewTransitionName: "top-navbar" }}
    >
      {navPage ? (
        <>
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
            <div className="flex items-center justify-center gap-2 min-w-0 pointer-events-auto">
              {navPage.icon ? (
                <span className="shrink-0">{navPage.icon}</span>
              ) : isTabPage ? (
                <ReceiptText className="h-5 w-5 shrink-0 text-tab-icon" />
              ) : null}
              <h1 className="truncate text-lg font-semibold">
                {navPage.title}
              </h1>
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
          <div className="relative z-10 flex shrink-0 justify-end">
            {isMePage && <SignOutButton />}
          </div>
        </>
      ) : (
        <TransitionLink href="/tabs" className="flex items-center gap-2">
          <Image
            src={appConfig.icons.sm.src}
            alt="Tab It Logo"
            width={52}
            height={52}
            className=""
          />
        </TransitionLink>
      )}
      {!navPage && (isMePage ? (
        <SignOutButton />
      ) : isFriendsListPage ? (
        <Button variant="default" size="sm" asChild aria-label="Add friend">
          <TransitionLink href="/friends/addFriend" className="">
            <Plus className="h-5 w-5" />
            <span>Friend</span>
          </TransitionLink>
        </Button>
      ) : isTabsListPage ? (
        <Button variant="default" size="sm" asChild aria-label="New tab">
          <TransitionLink href="/tabs/create" className="">
            <Plus className="h-5 w-5" />
            <span>Tab</span>
          </TransitionLink>
        </Button>
      ) : null)}
    </header>
  );
}

"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { appConfig } from "@/app/config";
import { useNavTitleConfig } from "../context/nav-title-context";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

export function TopNavbar() {
  const pathname = usePathname();
  const navPage = useNavTitleConfig();
  const isFriendsListPage =
    pathname === "/app/friends" || pathname === "/app/friends/";
  const isTabsListPage = pathname === "/app/tabs" || pathname === "/app/tabs/";
  const isTabPage =
    pathname.startsWith("/app/tabs/") && !pathname.match(/^\/app\/tabs\/?$/);

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
            asChild
            aria-label={`Back to ${navPage.backHref}`}
          >
            <TransitionLink href={navPage.backHref}>
              <ArrowLeft className="h-5 w-5" />
            </TransitionLink>
          </Button>
          <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
            {isTabPage && (
              <ReceiptText className="h-5 w-5 shrink-0 text-tab-icon" />
            )}
            <h1 className="truncate text-lg font-semibold">{navPage.title}</h1>
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
          <div className="w-9 shrink-0" aria-hidden />
        </>
      ) : (
        <TransitionLink href="/app/tabs" className="flex items-center gap-2">
          <Image
            src={appConfig.icons.sm.src}
            alt="Tab It Logo"
            width={52}
            height={52}
            className=""
          />
        </TransitionLink>
      )}
      {isFriendsListPage ? (
        <Button variant="ghost" size="sm" asChild aria-label="Add friend">
          <TransitionLink href="/app/friends/addFriend" className="gap-1.5">
            <Plus className="h-5 w-5" />
            <span>Friend</span>
          </TransitionLink>
        </Button>
      ) : isTabsListPage ? (
        <Button variant="ghost" size="sm" asChild aria-label="New tab">
          <TransitionLink href="/app/tabs/create" className="gap-1.5">
            <Plus className="h-5 w-5" />
            <span>Tab</span>
          </TransitionLink>
        </Button>
      ) : null}
    </header>
  );
}

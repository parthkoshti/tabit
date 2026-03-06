"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { ArrowLeft, Plus } from "lucide-react";
import { appConfig } from "@/app/config";
import { useNavTitleConfig } from "../context/nav-title-context";

export function TopNavbar() {
  const pathname = usePathname();
  const navPage = useNavTitleConfig();
  const isFriendsListPage =
    pathname === "/app/friends" || pathname === "/app/friends/";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
      {navPage ? (
        <>
          <TransitionLink
            href={navPage.backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={`Back to ${navPage.backHref}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </TransitionLink>
          <h1 className="flex-1 text-center text-lg font-semibold">
            {navPage.title}
          </h1>
          <div className="w-9 shrink-0" aria-hidden />
        </>
      ) : (
        <TransitionLink href="/app/groups" className="flex items-center gap-2">
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
        <TransitionLink
          href="/app/friends/addFriend"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Add friend"
        >
          <Plus className="h-5 w-5" />
          <span>Friend</span>
        </TransitionLink>
      ) : null}
    </header>
  );
}

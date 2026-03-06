"use client";

import { Link as TransitionLink } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, User, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingFriendRequests } from "@/app/actions/friends";
import { getPendingTabInviteRequests } from "@/app/actions/tab-invites";

const tabs = [
  { href: "/app/friends", label: "Friends", icon: Users },
  { href: "/app/tabs", label: "Tabs", icon: ReceiptText },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/me", label: "Me", icon: User },
] as const;

export function BottomNavbar() {
  const pathname = usePathname();
  const { data: friendRequestsData } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await getPendingFriendRequests();
      return r.success ? r.requests : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: tabInvitesData } = useQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await getPendingTabInviteRequests();
      return r.success ? r.requests : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const friendInviteCount = friendRequestsData?.length ?? 0;
  const tabInviteCount = tabInvitesData?.length ?? 0;

  return (
    <nav
      className="bottom-nav-safe fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background pt-2 pb-[env(safe-area-inset-bottom,0px)]"
      style={{ viewTransitionName: "bottom-navbar" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href === "/app/tabs" && pathname.startsWith("/app/tabs/"));
        const showBadge =
          (href === "/app/friends" && friendInviteCount > 0) ||
          (href === "/app/tabs" && tabInviteCount > 0);
        const badgeCount =
          href === "/app/friends" ? friendInviteCount : tabInviteCount;

        return (
          <Button
            key={href}
            variant="ghost"
            size="sm"
            className={`flex flex-col gap-1 px-4 py-1 h-auto text-xs font-normal ${
              isActive ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
            asChild
          >
            <TransitionLink href={href}>
              <span className="relative inline-block">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-foreground">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </span>
              {label}
            </TransitionLink>
          </Button>
        );
      })}
    </nav>
  );
}

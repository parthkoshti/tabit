import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Users, Activity, User, ReceiptText } from "lucide-react";
import { useNeedsPushResubscription } from "@/app/(app)/context/push-resubscription-context";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

const tabs = [
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/tabs", label: "Tabs", icon: ReceiptText },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/me", label: "Me", icon: User },
] as const;

export function BottomNavbar() {
  const { pathname } = useLocation();
  const { data: session } = authClient.useSession();
  const { data: friendRequestsData } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await api.friends.getPendingRequests();
      return r.success ? r.requests : [];
    },
  });
  const { data: tabInvitesData } = useQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await api.tabInvites.getPendingRequests();
      return r.success ? r.requests : [];
    },
  });
  const friendInviteCount = friendRequestsData?.length ?? 0;
  const tabInviteCount = tabInvitesData?.length ?? 0;
  const needsPushResubscription = useNeedsPushResubscription();
  const { needRefresh: [needRefresh] } = useRegisterSW();

  return (
    <nav className="bottom-nav-safe fixed bottom-8 left-0 right-0 z-40 flex justify-center px-4 pb-4 pt-2">
      <div className="frosted-glass flex gap-1 w-full max-w-sm items-center justify-around rounded-full border border-border/60 bg-background/95 px-2 py-2 shadow-lg">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href === "/tabs" && pathname.startsWith("/tabs/"));
          const showBadge =
            (href === "/friends" && friendInviteCount > 0) ||
            (href === "/tabs" && tabInviteCount > 0) ||
            (href === "/activity" && needRefresh) ||
            (href === "/me" && needsPushResubscription);
          const badgeCount =
            href === "/friends"
              ? friendInviteCount
              : href === "/tabs"
                ? tabInviteCount
                : 0;
          const isMeTab = href === "/me";
          const isUpdateBadge = href === "/activity" && needRefresh;
          const showAvatar = isMeTab && session?.user?.id;

          return (
            <Button
              key={href}
              variant="ghost"
              size="sm"
              className={`flex w-full h-full flex-col gap-1 px-4 py-1 text-xs font-normal hover:bg-transparent ${
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
              asChild
            >
              <Link to={href}>
                <span className="relative inline-block">
                  {showAvatar ? (
                    <UserAvatar
                      userId={session.user.id}
                      size="sm"
                      className="h-8 w-8"
                    />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {showBadge && (
                    <span
                      className={`absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-foreground ${
                        (href === "/me" && needsPushResubscription) || isUpdateBadge
                          ? "h-2 w-2 min-w-2"
                          : "h-4 min-w-4 px-1"
                      }`}
                    >
                      {(href === "/me" && needsPushResubscription) || isUpdateBadge
                        ? null
                        : badgeCount > 9
                          ? "9+"
                          : badgeCount}
                    </span>
                  )}
                </span>
                {!isMeTab && label}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

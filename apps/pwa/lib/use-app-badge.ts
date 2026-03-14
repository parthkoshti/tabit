import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

function setBadge(count: number): void {
  if (typeof navigator === "undefined") return;
  if (!("setAppBadge" in navigator)) return;
  try {
    if (count > 0) {
      (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> })
        .setAppBadge(count);
    } else {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> })
        .clearAppBadge();
    }
  } catch {
    // Badging API not supported or failed
  }
}

export function useAppBadge(enabled: boolean): void {
  const { pathname } = useLocation();

  const { data: friendRequestsData } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await api.friends.getPendingRequests();
      return r.success ? r.requests : [];
    },
    enabled,
  });

  const { data: tabInvitesData } = useQuery({
    queryKey: ["pendingTabInviteRequests"],
    queryFn: async () => {
      const r = await api.tabInvites.getPendingRequests();
      return r.success ? r.requests : [];
    },
    enabled,
  });

  const friendCount = friendRequestsData?.length ?? 0;
  const tabInviteCount = tabInvitesData?.length ?? 0;

  const isViewingFriends = pathname === "/friends" || pathname === "/friends/";
  const isViewingTabs = pathname === "/tabs" || pathname.startsWith("/tabs/");

  const unreadCount =
    (isViewingFriends ? 0 : friendCount) + (isViewingTabs ? 0 : tabInviteCount);

  useEffect(() => {
    if (!enabled) {
      setBadge(0);
      return;
    }
    setBadge(unreadCount);
  }, [enabled, unreadCount]);
}

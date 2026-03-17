import type { ReactNode } from "react";
import { create } from "zustand";

export type NavTitleConfig = {
  title: string;
  backHref: string;
  avatarUserIds?: string[];
  avatarDisplayName?: string;
  icon?: ReactNode;
};

/** Pre-known nav configs for tab-level routes. Prevents flash when route's useEffect hasn't run yet. */
const TAB_ROUTE_NAV_CONFIG: Record<string, NavTitleConfig | null> = {
  "/me": { title: "Profile", backHref: "/tabs" },
  "/expense/new": { title: "Log Expense", backHref: "/tabs" },
  "/friends": null,
  "/friends/": null,
  "/tabs": null,
  "/tabs/": null,
  "/activity": null,
};

function getDefaultNavConfig(pathname: string): NavTitleConfig | null {
  if (pathname === "/me") return TAB_ROUTE_NAV_CONFIG["/me"];
  if (pathname === "/expense/new") return TAB_ROUTE_NAV_CONFIG["/expense/new"];
  if (pathname === "/friends" || pathname === "/friends/")
    return TAB_ROUTE_NAV_CONFIG["/friends"];
  if (pathname === "/tabs" || pathname === "/tabs/")
    return TAB_ROUTE_NAV_CONFIG["/tabs"];
  if (pathname === "/activity") return TAB_ROUTE_NAV_CONFIG["/activity"];
  return null;
}

interface NavState {
  displayPathname: string;
  navPage: NavTitleConfig | null;
  setDisplayPathname: (pathname: string) => void;
  setNavPage: (config: NavTitleConfig | null) => void;
}

export const useNavStore = create<NavState>((set) => ({
  displayPathname: "",
  navPage: null,
  setDisplayPathname: (pathname) =>
    set({
      displayPathname: pathname,
      navPage: getDefaultNavConfig(pathname),
    }),
  setNavPage: (config) => set({ navPage: config }),
}));

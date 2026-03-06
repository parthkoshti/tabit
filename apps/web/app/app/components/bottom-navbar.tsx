"use client";

import { Link as TransitionLink } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { Users, LayoutGrid, Activity, User, ReceiptText } from "lucide-react";

const tabs = [
  { href: "/app/friends", label: "Friends", icon: Users },
  { href: "/app/tabs", label: "Tabs", icon: ReceiptText },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/me", label: "Me", icon: User },
] as const;

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav-safe fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background pt-2 pb-[env(safe-area-inset-bottom,0px)]"
      style={{ viewTransitionName: "bottom-navbar" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href === "/app/tabs" && pathname.startsWith("/app/tabs/"));

        return (
          <TransitionLink
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-4 py-1 text-xs transition-colors ${
              isActive ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </TransitionLink>
        );
      })}
    </nav>
  );
}

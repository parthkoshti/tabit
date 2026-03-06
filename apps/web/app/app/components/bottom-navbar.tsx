"use client";

import { Link as TransitionLink } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { Users, LayoutGrid, Activity, User } from "lucide-react";

const tabs = [
  { href: "/app/friends", label: "Friends", icon: Users },
  { href: "/app/groups", label: "Groups", icon: LayoutGrid },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/me", label: "Me", icon: User },
] as const;

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-2 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)] pt-2">
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href === "/app/groups" && pathname.startsWith("/app/groups/"));

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

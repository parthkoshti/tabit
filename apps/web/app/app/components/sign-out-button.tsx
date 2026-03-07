"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => authClient.signOut()}
    >
      <LogOut />
      Log Out
    </Button>
  );
}

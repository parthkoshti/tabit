"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => authClient.signOut()}>
      Sign out
    </Button>
  );
}

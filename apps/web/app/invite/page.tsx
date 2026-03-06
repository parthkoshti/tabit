"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { addFriendByToken } from "@/app/actions/friends";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const userParam = searchParams.get("user");
  const qrParam = searchParams.get("qr");

  useEffect(() => {
    if (isPending) return;
    if (!qrParam) {
      setStatus("error");
      setError("Invalid invite link");
      return;
    }
    if (!session?.user) {
      const returnTo = `/invite?user=${encodeURIComponent(userParam ?? "")}&qr=${encodeURIComponent(qrParam)}`;
      router.replace(`/login?callbackURL=${encodeURIComponent(returnTo)}`);
      return;
    }
    addFriendByToken(qrParam).then((result) => {
      if (result.success && result.friendGroupId) {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        router.replace(`/app/groups/${result.friendGroupId}`);
      } else {
        setStatus("error");
        setError(result.error ?? "Failed to add friend");
      }
    });
  }, [session, isPending, qrParam, userParam, router, queryClient]);

  if (status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <a href="/login" className="mt-4 text-primary underline">
          Sign in
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

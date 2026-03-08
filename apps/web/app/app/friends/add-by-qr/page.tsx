"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useNavTitle } from "@/app/app/context/nav-title-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function AddByQRContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const setNavTitle = useNavTitle();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");
  const qr = searchParams.get("qr");
  const userParam = searchParams.get("user");
  const code = qr ?? token;

  useEffect(() => {
    setNavTitle?.({ title: "Add friend", backHref: "/app/friends" });
    return () => setNavTitle?.(null);
  }, [setNavTitle]);

  useEffect(() => {
    if (!code) {
      router.replace("/app/friends/addFriend");
      return;
    }
    if (token && !qr) {
      router.replace(`/invite?user=${encodeURIComponent(userParam ?? "")}&qr=${encodeURIComponent(token)}`);
      return;
    }

    api.friends.addByToken(code).then((result) => {
      if (result.success && result.friendTabId) {
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["tabs"] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        router.replace(`/app/tabs/${result.friendTabId}`);
      } else {
        setStatus("error");
        setError(result.error ?? "Failed to add friend");
      }
    });
  }, [code, token, qr, userParam, router, queryClient]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <Button variant="link" onClick={() => router.push("/app/friends")} className="mt-4">
          Back to friends
        </Button>
      </div>
    );
  }

  return null;
}

export default function AddByQRPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center p-4">
          <Spinner />
        </div>
      }
    >
      <AddByQRContent />
    </Suspense>
  );
}

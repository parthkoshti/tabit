import { useEffect, useState, Suspense } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { needsProfileSetup } from "@/lib/profile";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getDisplayName } from "@/lib/display-name";

function InviteContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<
    "loading" | "error" | "tab-accept" | "tab-success"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [tabInvite, setTabInvite] = useState<{
    tab: { id: string; name: string };
    creator: { id: string; name: string | null; username: string | null };
    tabId: string;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);

  const typeParam = searchParams.get("type");
  const tokenParam = searchParams.get("token");
  const userParam = searchParams.get("user");
  const qrParam = searchParams.get("qr");

  const isTabInvite = typeParam === "tab" && tokenParam;

  useEffect(() => {
    if (isPending) return;

    if (session?.user && needsProfileSetup(session.user)) {
      const returnTo =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      navigate(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, {
        replace: true,
      });
      return;
    }

    if (isTabInvite) {
      if (!session?.user) {
        const returnTo = `/invite?type=tab&token=${encodeURIComponent(tokenParam!)}`;
        navigate(`/login?callbackURL=${encodeURIComponent(returnTo)}`, {
          replace: true,
        });
        return;
      }
      api.tabInvites.getByToken(tokenParam!).then((result) => {
        if (result.success && result.tab && result.creator && result.tabId) {
          setTabInvite({
            tab: result.tab,
            creator: result.creator,
            tabId: result.tabId,
          });
          setStatus("tab-accept");
        } else {
          setStatus("error");
          setError(result.error ?? "Invalid or expired link");
        }
      });
      return;
    }

    if (qrParam) {
      if (!session?.user) {
        const returnTo = `/invite?user=${encodeURIComponent(userParam ?? "")}&qr=${encodeURIComponent(qrParam)}`;
        navigate(`/login?callbackURL=${encodeURIComponent(returnTo)}`, {
          replace: true,
        });
        return;
      }
      api.friends.addByToken(qrParam).then((result) => {
        if (result.success && result.friendTabId) {
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          queryClient.invalidateQueries({ queryKey: ["tabs"] });
          queryClient.invalidateQueries({ queryKey: ["activity"] });
          navigate(`/tabs/${result.friendTabId}`, { replace: true });
        } else {
          setStatus("error");
          setError(result.error ?? "Failed to add friend");
        }
      });
      return;
    }

    setStatus("error");
    setError("Invalid invite link");
  }, [
    session,
    isPending,
    pathname,
    searchParams,
    qrParam,
    userParam,
    navigate,
    queryClient,
    isTabInvite,
    tokenParam,
  ]);

  async function handleAcceptTabInvite() {
    if (!tokenParam) return;
    setAccepting(true);
    const result = await api.tabInvites.joinByToken(tokenParam);
    setAccepting(false);
    if (result.success && result.tabId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (result.alreadyMember) {
        navigate(`/tabs/${result.tabId}`, { replace: true });
      } else {
        setStatus("tab-success");
        setTimeout(() => {
          navigate(`/tabs/${result.tabId}`, { replace: true });
        }, 500);
      }
    } else {
      setStatus("error");
      setError(result.error ?? "Failed to join tab");
    }
  }

  if (status === "tab-accept" && tabInvite) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Join tab</h1>
          <p className="text-sm text-muted-foreground">
            {getDisplayName({ ...tabInvite.creator, email: "" })} invited you to join{" "}
            <span className="font-medium">{tabInvite.tab.name}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/tabs")}
              disabled={accepting}
            >
              Decline
            </Button>
            <Button
              variant="positive"
              className="flex-1"
              onClick={handleAcceptTabInvite}
              disabled={accepting}
            >
              {accepting ? "Joining..." : "Accept"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (status === "tab-success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">You joined the tab. Redirecting...</p>
        <Spinner className="mt-4" />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <Button variant="link" asChild className="mt-4">
          <Link to="/login">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Spinner />
    </main>
  );
}

export function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <Spinner />
        </main>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

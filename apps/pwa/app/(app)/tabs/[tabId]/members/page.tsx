"use client";

import { use, useMemo, useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNavTitle } from "../../../context/nav-title-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTab } from "@/app/actions/queries";
import { api } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Settings, Share2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Spinner } from "@/components/ui/spinner";
import { appConfig } from "@/app/config";
import Image from "next/image";
import QRCode from "qrcode";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getDisplayName } from "@/lib/display-name";

function TabQRCode({ tabId }: { tabId: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tabInviteToken", tabId],
    queryFn: async () => {
      const result = await api.tabInvites.getToken(tabId);
      if (!result.success) throw new Error(result.error ?? "Failed to load");
      return result.url!;
    },
    enabled: !!tabId,
  });

  const url = data ?? null;

  async function handleCopy(): Promise<boolean> {
    if (!url) return false;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return true;
      } catch {
        setCopyError("Could not copy. Select and copy the link manually.");
        setTimeout(() => setCopyError(null), 3000);
        return false;
      }
    }
  }

  async function handleShare() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join tab on ${appConfig.name}`,
          text: `You've been invited to join a tab on ${appConfig.name}`,
          url,
        });
      } catch (err) {
        const denied = err instanceof Error && err.name === "AbortError";
        if (!denied) await handleCopy();
      }
    } else {
      await handleCopy();
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  if (isLoading || !url) {
    return (
      <div className="flex aspect-square w-48 items-center justify-center rounded-lg border bg-muted">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex aspect-square w-48 items-center justify-center rounded-lg border bg-white p-2">
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center"
              style={{ width: 180, height: 180 }}
            >
              <Spinner size="sm" />
            </div>
          }
        >
          <QRCodeDisplay value={url} size={180} />
        </Suspense>
      </div>
      {copyError && (
        <div className="space-y-1 text-center">
          <p className="text-xs text-destructive">{copyError}</p>
          <p className="break-all text-xs text-muted-foreground select-all">
            {url}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="default" size="lg" onClick={handleCopy}>
          <Copy className="h-5 w-5" />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" size="lg" onClick={handleShare}>
          <Share2 className="h-5 w-5" />
          Share
        </Button>
      </div>
    </div>
  );
}

function QRCodeDisplay({ value, size }: { value: string; size: number }) {
  const promise = useMemo(
    () => QRCode.toDataURL(value, { width: size }),
    [value, size],
  );
  const dataUrl = use(promise);
  return (
    <Image
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      className="rounded"
      unoptimized
    />
  );
}

export default function ManageMembersPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId as string;
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; username: string | null; name: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const queryClient = useQueryClient();
  const setNavTitle = useNavTitle();

  const { data: session } = authClient.useSession();
  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
  });
  const currentUserId = session?.user?.id ?? "";
  const currentUserMember = tab?.members.find(
    (m) => m.userId === currentUserId,
  );
  const isAdmin = currentUserMember?.role === "owner";
  const memberToRemove = removeMemberId
    ? tab?.members.find((m) => m.userId === removeMemberId)
    : null;

  async function handleRemoveMember(userId: string) {
    if (!tabId) return;
    setRemoving(true);
    const result = await api.tabs.removeMember(tabId, userId);
    setRemoving(false);
    setRemoveMemberId(null);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
      toast.success("Member removed");
    } else {
      toast.error(result.error ?? "Failed to remove member");
    }
  }

  const otherMember = tab?.members.find(
    (m) => m.userId !== currentUserId,
  )?.user;
  const navTitle = tab
    ? tab.isDirect && otherMember
      ? `Tab with ${getDisplayName(otherMember, currentUserId)}`
      : tab.name
    : "Invite members";
  const avatarUserIds = useMemo(
    () =>
      tab?.members
        .filter((m) => m.userId !== currentUserId)
        .map((m) => m.userId) ?? [],
    [tab?.members, currentUserId],
  );
  const avatarDisplayName =
    tab?.isDirect && otherMember
      ? getDisplayName(otherMember, currentUserId)
      : undefined;

  useEffect(() => {
    setNavTitle?.({
      title: navTitle,
      backHref: `/tabs/${tabId}`,
      avatarUserIds: avatarUserIds.length > 0 ? avatarUserIds : undefined,
      avatarDisplayName,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, navTitle, tabId, avatarUserIds, avatarDisplayName]);

  const memberIds = useMemo(
    () => new Set(tab?.members.map((m) => m.userId) ?? []),
    [tab?.members],
  );

  useEffect(() => {
    if (!username.trim() || username.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await api.friends.search(username, {
        includeFriends: true,
      });
      const users = result.success ? result.users : [];
      setSearchResults(users.filter((u) => !memberIds.has(u.id)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [username, memberIds]);

  async function handleInvite(targetUsername: string) {
    if (!tabId) return;
    setLoading(true);
    setError(null);

    const result = await api.tabInvites.sendRequest(tabId, targetUsername);

    if (result.success) {
      toast.success("Invite sent");
      setSearchResults((prev) =>
        prev.filter((u) => u.username !== targetUsername),
      );
      queryClient.invalidateQueries({ queryKey: ["tabInviteToken", tabId] });
    } else {
      setError(result.error ?? "Failed to send invite");
    }
    setLoading(false);
  }

  if (!tabId) return null;

  if (tabLoading || !tab) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6 pb-24">
        {!tab.isDirect && isAdmin && (
          <section className="space-y-4">
            <h2 className="text-base font-medium mb-1">Manage tab</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Rename this tab
            </p>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              asChild
            >
              <Link href={`/tabs/${tabId}/manage`}>
                <Settings className="h-4 w-4" />
                Rename tab
              </Link>
            </Button>
          </section>
        )}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-medium mb-1">Members</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {tab.members.length} member{tab.members.length !== 1 ? "s" : ""}{" "}
              in this tab
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tab.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar userId={m.userId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getDisplayName(m.user, currentUserId)}
                      </span>
                      {m.role === "owner" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Admin
                        </span>
                      )}
                    </div>
                    {m.user.username && (
                      <span className="block text-sm text-muted-foreground">
                        @{m.user.username}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && m.userId !== currentUserId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveMemberId(m.userId)}
                    disabled={removing}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <AlertDialog
          open={removeMemberId !== null}
          onOpenChange={(open) => !open && setRemoveMemberId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove member?</AlertDialogTitle>
              <AlertDialogDescription>
                {memberToRemove
                  ? `Are you sure you want to remove ${getDisplayName(memberToRemove.user, currentUserId)} from this tab? They will lose access to the tab and its expenses.`
                  : "Are you sure you want to remove this member from the tab? They will lose access to the tab and its expenses."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  removeMemberId && handleRemoveMember(removeMemberId)
                }
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-medium mb-1">Invite members</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Search by username or share a link to add people to this tab
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Search by username
              </CardTitle>
              <CardDescription>
                Enter a username to invite them to this tab. They must accept
                first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading}
                className="text-sm"
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {searching && (
                <p className="text-sm text-muted-foreground">Searching...</p>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar userId={u.id} size="sm" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {u.name ?? u.username ?? "Unknown"}
                          </span>
                          {u.username && (
                            <span className="text-sm text-muted-foreground">
                              @{u.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleInvite(u.username ?? "")}
                        disabled={loading}
                      >
                        Invite to tab
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                QR code / Invite link
              </CardTitle>
              <CardDescription>
                Share this link or QR code. Existing users can accept to join
                the tab. New users will sign up and then join.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TabQRCode tabId={tabId} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

"use client";

import { use, useMemo, useEffect, useState, Suspense } from "react";
import { useNavTitle } from "../../context/nav-title-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
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
import { Copy, Share2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Spinner } from "@/components/ui/spinner";
import { appConfig } from "@/app/config";
import Image from "next/image";
import QRCode from "qrcode";

function MyQRCode() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["friendToken"],
    queryFn: async () => {
      const result = await api.friends.getToken();
      if (!result.success || !result.url)
        throw new Error(result.error ?? "Failed to load");
      return result.url;
    },
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
          title: "Add me as a friend",
          text: `Add me as a friend on ${appConfig.name}`,
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
        {error.message}
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

export default function AddFriendPage() {
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; username: string | null; name: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const setNavTitle = useNavTitle();

  useEffect(() => {
    setNavTitle?.({ title: "Add friend", backHref: "/friends" });
    return () => setNavTitle?.(null);
  }, [setNavTitle]);

  useEffect(() => {
    if (!username.trim() || username.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await api.friends.search(username);
      setSearchResults(result.success ? result.users : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleSendRequest(targetUsername: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await api.friends.sendRequest(targetUsername);

    if (result.success) {
      setSuccess("Friend request sent");
      setSearchResults((prev) =>
        prev.filter((u) => u.username !== targetUsername),
      );
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    } else {
      setError(result.error ?? "Failed to send request");
    }
    setLoading(false);
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Search by username</CardTitle>
            <CardDescription>
              Enter a username to send a friend request. They must approve
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
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
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
                      onClick={() => handleSendRequest(u.username ?? "")}
                      disabled={loading}
                    >
                      Send request
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR code</CardTitle>
            <CardDescription>
              Friends can scan your QR code to add you instantly. No approval
              needed. If they don't have an account, they'll become your friend
              when they sign up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MyQRCode />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

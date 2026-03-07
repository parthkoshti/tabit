"use client";

import { useEffect, useState, useRef, useMemo, use, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import {
  updateUsername,
  checkUsernameAvailability,
} from "@/app/actions/username";
import { updateName } from "@/app/actions/profile";
import { getFriendToken } from "@/app/actions/friends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CircleCheck,
  CircleX,
  Pencil,
  Copy,
  Share2,
  Github,
  Heart,
  ExternalLink,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Spinner } from "@/components/ui/spinner";
import { useNavTitle } from "../context/nav-title-context";
import { appConfig } from "@/app/config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import QRCode from "qrcode";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

function InviteQRCodeDisplay({ value, size }: { value: string; size: number }) {
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

export default function MePage() {
  const { data: session, refetch } = authClient.useSession();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);

  useEffect(() => {
    const u = session?.user as { username?: string; name?: string } | undefined;
    setUsername(u?.username ?? "");
    setName(u?.name ?? "");
  }, [session?.user]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [availability, setAvailability] = useState<
    "idle" | "loading" | "available" | "taken"
  >("idle");
  const checkIdRef = useRef(0);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const setNavTitle = useNavTitle();

  useEffect(() => {
    setNavTitle?.({ title: "Profile", backHref: "/app/tabs" });
    return () => setNavTitle?.(null);
  }, [setNavTitle]);

  useEffect(() => {
    if (!username.trim() || !USERNAME_REGEX.test(username.trim())) {
      setAvailability("idle");
      return;
    }
    setAvailability("loading");
    const id = ++checkIdRef.current;
    const timer = setTimeout(async () => {
      const value = username;
      const result = await checkUsernameAvailability(value);
      if (id === checkIdRef.current) {
        setAvailability(result.available ? "available" : "taken");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.set("username", username);

    const result = await updateUsername(formData);

    if (result.success) {
      setSuccess(true);
      refetch();
      setUsernameDialogOpen(false);
    } else {
      setError(result.error ?? "Failed to update username");
    }
    setUsernameLoading(false);
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameLoading(true);
    setNameError(null);
    setNameSuccess(false);

    const formData = new FormData();
    formData.set("name", name);

    const result = await updateName(formData);

    if (result.success) {
      setNameSuccess(true);
      refetch();
      setNameDialogOpen(false);
    } else {
      setNameError(result.error ?? "Failed to update name");
    }
    setNameLoading(false);
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-4">
              <UserAvatar userId={session?.user?.id ?? ""} size="lg" />
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {session?.user?.name || "No name set"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label="Edit name"
                    onClick={() => {
                      setName(session?.user?.name ?? "");
                      setNameError(null);
                      setNameSuccess(false);
                      setNameDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground truncate">
                    {session?.user?.username
                      ? `@${session.user.username}`
                      : "No username set"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label="Edit username"
                    onClick={() => {
                      setUsername(
                        (
                          session?.user as
                            | { username?: string; name?: string }
                            | undefined
                        )?.username ?? "",
                      );
                      setError(null);
                      setSuccess(false);
                      setUsernameDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
                {session?.user?.email && (
                  <p className="text-sm text-muted-foreground">
                    {session.user.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit name</DialogTitle>
                <DialogDescription>Update your display name</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={64}
                    disabled={nameLoading}
                  />
                </div>
                {nameError && (
                  <Alert variant="destructive">
                    <AlertDescription>{nameError}</AlertDescription>
                  </Alert>
                )}
                {nameSuccess && (
                  <Alert>
                    <AlertDescription>
                      Name updated successfully.
                    </AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNameDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={nameLoading}>
                    {nameLoading ? "Updating..." : "Update"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={usernameDialogOpen}
            onOpenChange={setUsernameDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit username</DialogTitle>
                <DialogDescription>
                  5-12 characters, letters, numbers, and underscores only. Must
                  be unique.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      minLength={5}
                      maxLength={12}
                      pattern="[a-zA-Z0-9_]+"
                      disabled={usernameLoading}
                      className="pr-24"
                    />
                    <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-muted-foreground">
                      {availability === "loading" && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {availability === "available" && (
                        <>
                          <CircleCheck className="h-4 w-4 text-positive" />
                          <span className="text-xs text-positive">
                            Available
                          </span>
                        </>
                      )}
                      {availability === "taken" && (
                        <>
                          <CircleX className="h-4 w-4 text-destructive" />
                          <span className="text-xs text-destructive">
                            Taken
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert>
                    <AlertDescription>
                      Username updated successfully.
                    </AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUsernameDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={usernameLoading}>
                    {usernameLoading ? "Updating..." : "Update"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </section>

        <SupportSection />

        <InviteSection />
      </div>
    </div>
  );
}

function SupportSection() {
  const { githubUrl, donateUrl } = appConfig;
  if (!githubUrl && !donateUrl) return null;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-medium mb-1">Like {appConfig.name}?</h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Star us on GitHub or consider donating to help development
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Github className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">Star on GitHub</span>
                <p className="text-[11px] text-muted-foreground">
                  Show your support
                </p>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          )}
          {donateUrl && (
            <div className="flex flex-col gap-2">
              <a
                href={donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                  <Heart
                    className="h-4 w-4 fill-red-500 text-red-500"
                    fill="currentColor"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">Consider donating</span>
                  <p className="text-[11px] text-muted-foreground">
                    Help fund development
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
              <Accordion
                type="single"
                collapsible
                className="rounded-lg border border-border bg-muted/30"
              >
                <AccordionItem value="why-donate" className="border-b-0 px-4">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline">
                    Why donate?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Donations help cover hosting costs, development time, and
                    keep {appConfig.name} free for everyone.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function InviteSection() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const {
    data: url,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["friendToken"],
    queryFn: async () => {
      const result = await getFriendToken();
      if (!result.success) throw new Error(result.error ?? "Failed to load");
      return result.url!;
    },
  });

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
      <section className="space-y-4">
        <h2 className="text-base font-medium mb-1">Add friends</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Share your QR code or invite link for others to add you as a friend
        </p>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      </section>
    );
  }

  if (isLoading || !url) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-medium mb-1">Add friends</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Share your QR code or invite link for others to add you as a friend
        </p>
        <div className="flex aspect-square w-48 items-center justify-center rounded-lg border bg-muted">
          <Spinner size="sm" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-medium mb-1">Add friends</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Share your QR code or invite link for others to add you as a friend
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
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
              <InviteQRCodeDisplay value={url} size={180} />
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
      </div>
    </section>
  );
}

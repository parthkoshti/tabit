"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { needsProfileSetup } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CircleCheck, CircleX, Smartphone } from "lucide-react";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

type Platform = "ios" | "android" | "web";

function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data: session,
    isPending: sessionPending,
    refetch,
  } = authClient.useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    "idle" | "loading" | "available" | "taken"
  >("idle");
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<{ outcome: string }>;
  } | null>(null);
  const deferredPromptRef = useRef<{
    prompt: () => Promise<{ outcome: string }>;
  } | null>(null);
  const [platform, setPlatform] = useState<Platform>("web");
  const [installed, setInstalled] = useState(false);
  const checkIdRef = useRef(0);

  const DISABLE_REDIRECT = false; // TODO: remove - temp disable to view page

  useEffect(() => {
    setPlatform(getPlatform());
    setInstalled(isStandalone());
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const ev = e as unknown as { prompt: () => Promise<{ outcome: string }> };
      const promptable = { prompt: () => ev.prompt() };
      deferredPromptRef.current = promptable;
      setDeferredPrompt(promptable);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      deferredPromptRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = () => setInstalled(true);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
    if (session?.user?.username) setUsername(session.user.username ?? "");
  }, [session?.user?.name, session?.user?.username]);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    if (!DISABLE_REDIRECT && !needsProfileSetup(session.user) && step !== 2) {
      const returnTo = searchParams.get("returnTo");
      const safeReturn =
        returnTo && returnTo !== "/onboarding" ? returnTo : "/tabs";
      router.replace(safeReturn);
    }
  }, [session, sessionPending, router, searchParams, step]);

  useEffect(() => {
    if (!username.trim() || !USERNAME_REGEX.test(username.trim())) {
      setAvailability("idle");
      return;
    }
    setAvailability("loading");
    const id = ++checkIdRef.current;
    const timer = setTimeout(async () => {
      const value = username;
      const result = await api.username.check(value);
      if (id === checkIdRef.current) {
        setAvailability(result.available ? "available" : "taken");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const [profileResult, usernameResult] = await Promise.all([
      api.profile.update(name.trim()),
      api.username.update(username.trim().toLowerCase()),
    ]);
    const result =
      profileResult.success && usernameResult.success
        ? { success: true as const }
        : {
            success: false as const,
            error: profileResult.error ?? usernameResult.error ?? "Failed",
          };

    if (result.success) {
      await refetch();
      setStep(2);
    } else {
      setError(result.error ?? "Failed to complete profile");
    }
    setLoading(false);
  }

  function handleStep2Continue() {
    const returnTo = searchParams.get("returnTo");
    const safeReturn =
      returnTo && returnTo !== "/onboarding" ? returnTo : "/tabs";
    router.replace(safeReturn);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  }

  if (sessionPending || !session?.user) {
    return null;
  }
  if (!DISABLE_REDIRECT && !needsProfileSetup(session.user) && step === 1) {
    return null;
  }

  if (step === 1) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-4">
        <div className="mb-4 text-center text-sm text-muted-foreground">
          Step 1 of 2
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Complete your profile</CardTitle>
            <CardDescription>
              Add your name and a unique username so others can find you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={64}
                  required
                  disabled={loading}
                />
              </div>
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
                    required
                    disabled={loading}
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-muted-foreground">
                    {availability === "loading" && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {availability === "available" && (
                      <>
                        <CircleCheck className="h-4 w-4 text-positive" />
                        <span className="text-xs text-positive">Available</span>
                      </>
                    )}
                    {availability === "taken" && (
                      <>
                        <CircleX className="h-4 w-4 text-destructive" />
                        <span className="text-xs text-destructive">Taken</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  5-12 characters, letters, numbers, and underscores only
                </p>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={
                  loading ||
                  !name.trim() ||
                  !username.trim() ||
                  !USERNAME_REGEX.test(username.trim()) ||
                  availability === "taken" ||
                  availability === "loading"
                }
                className="w-full"
              >
                {loading ? "Saving..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4">
      <div className="mb-4 text-center text-sm text-muted-foreground">
        Step 2 of 2
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Install the app</CardTitle>
          <CardDescription>
            Add Tab to your home screen for quick access and a better experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {installed ? (
            <p className="text-center text-sm text-muted-foreground">
              You have the app installed. You are all set.
            </p>
          ) : platform === "ios" ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium">iPhone / iPad (Safari):</p>
              <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
                <li>
                  Tap the{" "}
                  <span className="font-medium text-foreground">
                    Share button
                  </span>{" "}
                  button (square with arrow) at the bottom
                </li>
                <li>
                  Scroll down and tap{" "}
                  <span className="font-medium text-foreground">
                    Add to Home Screen
                  </span>
                </li>
                <li>
                  <span className="font-medium text-foreground">Tap Add</span>{" "}
                  in the top right
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Make sure you are in Safari, not another browser.
              </p>
            </div>
          ) : platform === "android" ? (
            <div className="space-y-3">
              {deferredPrompt ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Tap the button below to install Tab on your device.
                  </p>
                  <Button onClick={handleInstall} className="w-full" size="lg">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Install app
                  </Button>
                </>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium">Android (Chrome):</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Tap the menu (three dots) in the top right</li>
                    <li>Tap Add to Home screen or Install app</li>
                    <li>Tap Add or Install to confirm</li>
                  </ol>
                  <p className="text-xs">
                    Open this page in Chrome for the install option.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {deferredPrompt ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Install Tab for quick access from your desktop.
                  </p>
                  <Button onClick={handleInstall} className="w-full" size="lg">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Install app
                  </Button>
                </>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium">Desktop (Chrome, Edge):</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>
                      Look for the install icon in the address bar (plus or
                      computer icon)
                    </li>
                    <li>
                      Or open the menu (three dots) and select Install Tab /
                      Install app
                    </li>
                  </ol>
                  <p className="text-xs">
                    Chrome and Edge support installing this app. Other browsers
                    can bookmark this page.
                  </p>
                </div>
              )}
            </div>
          )}
          <Button
            variant={installed || deferredPrompt ? "default" : "outline"}
            onClick={handleStep2Continue}
            className="w-full"
          >
            {installed ? "Continue" : "Continue without installing"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

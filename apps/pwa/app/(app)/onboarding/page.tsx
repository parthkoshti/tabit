import { useState, useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { usernameSchema } from "models";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { needsProfileSetup } from "@/lib/profile";
import { zodFieldErrors } from "@/lib/form-zod";
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
import {
  Loader2,
  CircleCheck,
  CircleX,
  Smartphone,
  Share,
  SquarePlus,
  Bell,
} from "lucide-react";

const profileSetupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(64, "Name must be at most 64 characters"),
  username: usernameSchema,
});

type Platform = "ios" | "android" | "web";

function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ Safari reports "Macintosh" instead of "iPad" in user agent
  if (
    /Macintosh/.test(ua) &&
    navigator.maxTouchPoints > 1 &&
    !/Android/.test(ua)
  ) {
    return "ios";
  }
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

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    data: session,
    isPending: sessionPending,
    refetch,
  } = authClient.useSession();
  const [step, setStep] = useState<1 | 2>(1);
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
  const [notificationStatus, setNotificationStatus] = useState<
    "idle" | "loading" | "enabled" | "unsupported"
  >("idle");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const checkIdRef = useRef(0);

  const profileForm = useForm({
    defaultValues: { name: "", username: "" },
    validators: {
      onSubmit: ({ value }) => zodFieldErrors(profileSetupSchema, value),
    },
    onSubmit: async ({ value }) => {
      const [profileResult, usernameResult] = await Promise.all([
        api.profile.update({ name: value.name.trim() }),
        api.username.update(value.username.trim().toLowerCase()),
      ]);
      if (profileResult.success && usernameResult.success) {
        await refetch();
        setStep(2);
        return;
      }
      const message = !profileResult.success
        ? profileResult.error
        : !usernameResult.success
          ? usernameResult.error
          : "Failed to complete profile";
      profileForm.setErrorMap({
        onSubmit: { form: message, fields: {} },
      });
    },
  });

  const username = profileForm.state.values.username;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
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
    if (!installed || !vapidKey || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return;
        const hasPushSupport = "PushManager" in window || "pushManager" in reg;
        if (!hasPushSupport) {
          setNotificationStatus("unsupported");
          return;
        }
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (cancelled) return;
        setNotificationStatus(sub ? "enabled" : "idle");
      })
      .catch(() => setNotificationStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [installed, vapidKey]);

  useEffect(() => {
    if (session?.user?.name) {
      profileForm.setFieldValue("name", session.user.name);
    }
    if (session?.user?.username) {
      profileForm.setFieldValue("username", session.user.username ?? "");
    }
  }, [session?.user?.name, session?.user?.username, profileForm]);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!DISABLE_REDIRECT && !needsProfileSetup(session.user) && step !== 2) {
      const returnTo = searchParams.get("returnTo");
      const safeReturn =
        returnTo && returnTo !== "/onboarding" ? returnTo : "/tabs";
      navigate(safeReturn, { replace: true });
    }
  }, [session, sessionPending, navigate, searchParams, step]);

  useEffect(() => {
    const trimmed = username.trim();
    const parsed = usernameSchema.safeParse(trimmed);
    if (!trimmed || !parsed.success) {
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

  function handleStep2Continue() {
    const returnTo = searchParams.get("returnTo");
    const safeReturn =
      returnTo && returnTo !== "/onboarding" ? returnTo : "/tabs";
    navigate(safeReturn, { replace: true });
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  }

  async function handleEnableNotifications() {
    if (!vapidKey || !("serviceWorker" in navigator)) return;
    setNotificationLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const hasPushSupport = "PushManager" in window || "pushManager" in reg;
      if (!hasPushSupport) {
        setNotificationStatus("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setNotificationStatus("enabled");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationLoading(false);
        return;
      }
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      await api.push.subscribe(newSub.toJSON());
      setNotificationStatus("enabled");
    } catch {
      setNotificationStatus("unsupported");
    } finally {
      setNotificationLoading(false);
    }
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void profileForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <profileForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Your name"
                      maxLength={64}
                      required
                      disabled={profileForm.state.isSubmitting}
                    />
                    {field.state.meta.errors[0] ? (
                      <p className="text-sm text-destructive">
                        {String(field.state.meta.errors[0])}
                      </p>
                    ) : null}
                  </div>
                )}
              </profileForm.Field>
              <profileForm.Field name="username">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <Input
                        id="username"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="johndoe"
                        minLength={5}
                        maxLength={12}
                        pattern="[a-zA-Z0-9_]+"
                        required
                        disabled={profileForm.state.isSubmitting}
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
                    {field.state.meta.errors[0] ? (
                      <p className="text-sm text-destructive">
                        {String(field.state.meta.errors[0])}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        5-12 characters, letters, numbers, and underscores only
                      </p>
                    )}
                  </div>
                )}
              </profileForm.Field>
              {profileForm.state.errorMap.onSubmit?.form ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {String(profileForm.state.errorMap.onSubmit.form)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                disabled={
                  profileForm.state.isSubmitting ||
                  !profileForm.state.values.name.trim() ||
                  !profileForm.state.values.username.trim() ||
                  !usernameSchema.safeParse(
                    profileForm.state.values.username.trim(),
                  ).success ||
                  availability === "taken" ||
                  availability === "loading"
                }
                className="w-full"
              >
                {profileForm.state.isSubmitting ? "Saving..." : "Continue"}
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
            <div className="space-y-4">
              {vapidKey &&
              notificationStatus !== "enabled" &&
              notificationStatus !== "unsupported" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Turn on notifications
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you receive friend requests or tab invites
                  </p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={handleEnableNotifications}
                    disabled={notificationLoading}
                  >
                    {notificationLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 h-4 w-4" />
                        Enable notifications
                      </>
                    )}
                  </Button>
                </div>
              ) : notificationStatus === "enabled" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleCheck className="h-5 w-5 shrink-0 text-positive" />
                  <p>Notifications are on. You are all set.</p>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  You have the app installed. You are all set.
                </p>
              )}
            </div>
          ) : platform === "ios" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                iPhone / iPad (Safari)
              </p>
              <div className="space-y-2">
                <div className="flex gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    1
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-medium text-foreground shadow-sm">
                      <Share className="h-3.5 w-3.5 text-primary" />
                      Share
                    </span>{" "}
                    button at the bottom
                  </p>
                </div>
                <div className="flex gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    2
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Scroll down and tap{" "}
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-medium text-foreground shadow-sm">
                      <SquarePlus className="h-3.5 w-3.5 text-primary" />
                      Add to Home Screen
                    </span>
                  </p>
                </div>
                <div className="flex gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    3
                  </span>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Tap Add</span>{" "}
                    in the top right
                  </p>
                </div>
              </div>
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
            variant={installed || deferredPrompt ? "default" : "ghost"}
            onClick={handleStep2Continue}
            className="w-full font-normal text-muted-foreground"
          >
            {installed ? "Continue" : "Continue without installing"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

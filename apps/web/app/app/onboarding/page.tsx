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
import { Loader2, CircleCheck, CircleX } from "lucide-react";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending, refetch } = authClient.useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    "idle" | "loading" | "available" | "taken"
  >("idle");
  const checkIdRef = useRef(0);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    if (!needsProfileSetup(session.user)) {
      const returnTo = searchParams.get("returnTo");
      const safeReturn =
        returnTo && returnTo !== "/app/onboarding" ? returnTo : "/app/tabs";
      router.replace(safeReturn);
    }
  }, [session, sessionPending, router, searchParams]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const [profileResult, usernameResult] = await Promise.all([
      api.profile.update(name.trim()),
      api.username.update(username.trim().toLowerCase()),
    ]);
    const result = profileResult.success && usernameResult.success
      ? { success: true as const }
      : { success: false as const, error: profileResult.error ?? usernameResult.error ?? "Failed" };

    if (result.success) {
      await refetch();
      const returnTo = searchParams.get("returnTo");
      const safeReturn =
        returnTo && returnTo !== "/app/onboarding" ? returnTo : "/app/tabs";
      router.replace(safeReturn);
    } else {
      setError(result.error ?? "Failed to complete profile");
    }
    setLoading(false);
  }

  if (sessionPending || !session?.user) {
    return null;
  }
  if (!needsProfileSetup(session.user)) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Add your name and a unique username so others can find you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

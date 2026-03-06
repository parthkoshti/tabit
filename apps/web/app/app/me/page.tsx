"use client";

import { useEffect, useState, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import {
  updateUsername,
  checkUsernameAvailability,
} from "@/app/actions/username";
import { updateName } from "@/app/actions/profile";
import { SignOutButton } from "../components/sign-out-button";
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
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;

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
    } else {
      setNameError(result.error ?? "Failed to update name");
    }
    setNameLoading(false);
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar userId={session?.user?.id ?? ""} size="lg" />
              <div className="flex flex-col gap-1">
                {session?.user?.name && (
                  <span className="font-medium">{session.user.name}</span>
                )}
                {session?.user?.email && (
                  <p className="text-sm text-muted-foreground">
                    {session.user.email}
                  </p>
                )}
              </div>
            </div>
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
                  <AlertDescription>Name updated successfully.</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={nameLoading} className="w-full">
                {nameLoading ? "Updating..." : "Update name"}
              </Button>
            </form>
            <SignOutButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Username</CardTitle>
            <CardDescription>
              5-12 characters, letters, numbers, and underscores only. Must be
              unique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      minLength={5}
                      maxLength={12}
                      pattern="[a-zA-Z0-9_]+"
                      disabled={usernameLoading}
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {availability === "loading" && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {availability === "available" && (
                        <CircleCheck className="h-4 w-4 text-positive" />
                      )}
                      {availability === "taken" && (
                        <CircleX className="h-4 w-4 text-destructive" />
                      )}
                    </span>
                  </div>
                  {availability === "available" && (
                    <Badge variant="secondary" className="shrink-0">Available</Badge>
                  )}
                  {availability === "taken" && (
                    <Badge variant="destructive" className="shrink-0">Taken</Badge>
                  )}
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
              <Button type="submit" disabled={usernameLoading} className="w-full">
                {usernameLoading ? "Updating..." : "Update username"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

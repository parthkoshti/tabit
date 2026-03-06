"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const { error: err } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/groups",
    });

    if (err) {
      setStatus("error");
      setError(err.message ?? "Failed to send magic link");
      return;
    }

    setStatus("success");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Tabit</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a magic link to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" ? (
            <Alert>
              <AlertDescription>
                Check your email for the magic link. It expires in 5 minutes.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "loading"}
                  placeholder="you@example.com"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={status === "loading"}
                className="w-full"
              >
                {status === "loading" ? "Sending..." : "Send magic link"}
              </Button>
            </form>
          )}

          <Button variant="link" asChild className="w-full">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

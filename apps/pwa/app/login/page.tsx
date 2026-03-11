import { useState, useEffect, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { appConfig } from "@/src/config";
import { authClient } from "@/lib/auth-client";
import { Link } from "react-router-dom";
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
import { Spinner } from "@/components/ui/spinner";

function LoginForm() {
  const [searchParams] = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? "/tabs";
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!isPending && session?.user) {
      navigate("/", { replace: true });
    }
  }, [session, isPending, navigate]);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (err) {
      setStatus("error");
      setError(err.message ?? "Failed to send OTP");
      return;
    }

    setStep("otp");
    setStatus("idle");
    setError(null);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const { error: err } = await authClient.signIn.emailOtp({
      email,
      otp,
      callbackURL,
    });

    if (err) {
      setStatus("error");
      setError(err.message ?? "Invalid or expired code");
      return;
    }

    navigate(callbackURL);
  }

  function handleBackToEmail() {
    setStep("email");
    setOtp("");
    setError(null);
    setStatus("idle");
  }

  if (isPending || session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {appConfig.name}</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email and we'll send you a one-time code to sign in."
              : "Enter the 6-digit code we sent to your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
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
                {status === "loading" ? "Sending..." : "Send code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  disabled={status === "loading"}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg tracking-[0.5em]"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={status === "loading" || otp.length !== 6}
                className="w-full"
              >
                {status === "loading" ? "Verifying..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToEmail}
                disabled={status === "loading"}
                className="w-full"
              >
                Use a different email
              </Button>
            </form>
          )}

          <Button variant="link" asChild className="w-full">
            <Link to="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <Spinner />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

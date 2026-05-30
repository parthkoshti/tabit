import { useState, useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useNavigate, useSearchParams, Link } from "@/lib/navigation";
import { authClient } from "@/lib/auth-client";
import { zodFieldErrors } from "@/lib/form-zod";
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
import { Mail, KeyRound, Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter the 6-digit code"),
});

const COPY: Record<
  AuthMode,
  {
    title: string;
    otpTitle: string;
    emailDescription: string;
    sendButton: string;
    verifyButton: string;
    backLink: string;
    switchPrompt: string;
    switchLink: string;
    switchHref: string;
  }
> = {
  login: {
    title: "Sign in",
    otpTitle: "Enter code",
    emailDescription: "Enter your email and we'll send you a one-time code.",
    sendButton: "Send code",
    verifyButton: "Sign in",
    backLink: "Back to home",
    switchPrompt: "New user?",
    switchLink: "Sign up",
    switchHref: "/signup",
  },
  signup: {
    title: "Create account",
    otpTitle: "Enter code",
    emailDescription:
      "Enter your email to get started. We'll send you a one-time code.",
    sendButton: "Send code",
    verifyButton: "Create account",
    backLink: "Back to home",
    switchPrompt: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login",
  },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [searchParams] = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? "/tabs";
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  const copy = COPY[mode];

  const otpForm = useForm({
    defaultValues: { otp: "" },
    validators: {
      onSubmit: ({ value }) => zodFieldErrors(otpSchema, value),
    },
    onSubmit: async ({ value }) => {
      const { error: err } = await authClient.signIn.emailOtp({
        email: verifiedEmail,
        otp: value.otp,
        callbackURL,
      });

      if (err) {
        otpForm.setErrorMap({
          onSubmit: {
            form: err.message ?? "Invalid or expired code",
            fields: {},
          },
        });
        return;
      }

      navigate(callbackURL);
    },
  });

  const emailForm = useForm({
    defaultValues: { email: "" },
    validators: {
      onSubmit: ({ value }) => zodFieldErrors(emailSchema, value),
    },
    onSubmit: async ({ value }) => {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email: value.email.trim(),
        type: "sign-in",
      });

      if (err) {
        emailForm.setErrorMap({
          onSubmit: { form: err.message ?? "Failed to send OTP", fields: {} },
        });
        return;
      }

      setVerifiedEmail(value.email.trim());
      otpForm.reset();
      setStep("otp");
    },
  });

  useEffect(() => {
    if (!isPending && session?.user) {
      navigate(callbackURL, { replace: true });
    }
  }, [session, isPending, navigate, callbackURL]);

  function handleBackToEmail() {
    setStep("email");
    otpForm.reset();
  }

  const switchHrefWithCallback =
    searchParams.get("callbackURL") != null
      ? `${copy.switchHref}?callbackURL=${encodeURIComponent(callbackURL)}`
      : copy.switchHref;

  if (isPending || session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-primary/5 via-background to-background p-8 top-nav-safe">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-primary/5 via-background to-background p-6 sm:p-8 top-nav-safe">
      <div className="mb-6 flex flex-col items-center gap-2">
        <img
          src="/icon-192x192.png"
          alt=""
          className="h-14 w-14 rounded-2xl shadow-md"
        />
        <p className="text-center text-sm text-muted-foreground">
          Split expenses with friends
        </p>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            {step === "email" ? (
              <Mail className="h-5 w-5 text-primary" />
            ) : (
              <KeyRound className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="text-lg">
              {step === "email" ? copy.title : copy.otpTitle}
            </CardTitle>
          </div>
          <CardDescription>
            {step === "email"
              ? copy.emailDescription
              : `We sent a 6-digit code to ${verifiedEmail}. Enter it below.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void emailForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <emailForm.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      disabled={emailForm.state.isSubmitting}
                      placeholder="you@example.com"
                      className="h-11"
                    />
                    {field.state.meta.errors[0] ? (
                      <p className="text-sm text-destructive">
                        {String(field.state.meta.errors[0])}
                      </p>
                    ) : null}
                  </div>
                )}
              </emailForm.Field>
              {emailForm.state.errorMap.onSubmit?.form ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {String(emailForm.state.errorMap.onSubmit.form)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                disabled={emailForm.state.isSubmitting}
                className="h-11 w-full"
              >
                {emailForm.state.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  copy.sendButton
                )}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void otpForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <otpForm.Field name="otp">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      onBlur={field.handleBlur}
                      required
                      disabled={otpForm.state.isSubmitting}
                      placeholder="000000"
                      maxLength={6}
                      className="h-12 text-center text-lg tracking-[0.5em] input-no-spinner"
                    />
                    {field.state.meta.errors[0] ? (
                      <p className="text-sm text-destructive">
                        {String(field.state.meta.errors[0])}
                      </p>
                    ) : null}
                  </div>
                )}
              </otpForm.Field>
              {otpForm.state.errorMap.onSubmit?.form ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {String(otpForm.state.errorMap.onSubmit.form)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <otpForm.Subscribe
                selector={(state) => ({
                  otp: state.values.otp,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ otp, isSubmitting }) => (
                  <>
                    <Button
                      type="submit"
                      disabled={isSubmitting || otp.length !== 6}
                      className="h-11 w-full"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        copy.verifyButton
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleBackToEmail}
                      disabled={isSubmitting}
                      className="h-10 w-full text-muted-foreground"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Use a different email
                    </Button>
                  </>
                )}
              </otpForm.Subscribe>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {copy.switchPrompt}{" "}
          <Link
            to={switchHrefWithCallback}
            className="font-medium text-primary hover:underline"
          >
            {copy.switchLink}
          </Link>
        </p>
        <Link
          to="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {copy.backLink}
        </Link>
      </div>
    </main>
  );
}

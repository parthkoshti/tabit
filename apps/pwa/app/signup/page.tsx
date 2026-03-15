import { Suspense } from "react";
import { AuthForm } from "@/app/auth/auth-form";
import { Spinner } from "@/components/ui/spinner";

export function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <Spinner />
        </main>
      }
    >
      <AuthForm mode="signup" />
    </Suspense>
  );
}

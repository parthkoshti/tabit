"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </main>
  );
}

import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">Page not found</p>
      <Button asChild className="mt-4">
        <TransitionLink href="/">Go home</TransitionLink>
      </Button>
    </main>
  );
}

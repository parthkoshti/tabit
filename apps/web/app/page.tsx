import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Tabit</h1>
        <p className="text-muted-foreground">Split expenses with friends</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}

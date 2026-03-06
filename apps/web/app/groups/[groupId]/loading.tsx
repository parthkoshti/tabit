import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GroupLoading() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

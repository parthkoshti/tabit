import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GroupsLoading() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-10 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

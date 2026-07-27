import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TabListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

export function TabListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <TabListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ExpenseCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-4 flex-1 max-w-48" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ExpenseListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ExpenseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ActivityListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-40" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
          <Skeleton className="h-3 w-48" />
          <div className="flex items-end justify-between gap-3 pt-0.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-20 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BalancesRowsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BalancesSkeleton() {
  return (
    <section>
      <Skeleton className="mb-2 h-5 w-24" />
      <Card>
        <CardContent className="p-4">
          <BalancesRowsSkeleton />
        </CardContent>
      </Card>
    </section>
  );
}

export function TabPageSkeleton() {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
        </div>
        <BalancesSkeleton />
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
          <Card>
            <CardContent className="p-3 pt-4">
              <Skeleton className="h-36 w-full rounded-md" />
            </CardContent>
          </Card>
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <ExpenseListSkeleton />
        </section>
      </div>
    </div>
  );
}

export function LedgerDetailSkeleton() {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-8">
        <div className="space-y-5">
          <Skeleton className="h-4 w-32" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1 max-w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-4 p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-full max-w-xs" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MembersPageSkeleton() {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6">
        <section className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-10 w-full rounded-md" />
        </section>
        <section className="space-y-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-40" />
          <ul className="divide-y divide-border rounded-lg border border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <QRSkeleton />
        </section>
      </div>
    </div>
  );
}

export function QRSkeleton() {
  return (
    <Skeleton className="aspect-square w-48 rounded-lg border bg-muted" />
  );
}

export function InlinePageSkeleton({ label }: { label?: string }) {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-4">
        {label ? (
          <p className="text-sm text-muted-foreground">{label}</p>
        ) : null}
        <ActivityListSkeleton count={1} />
      </div>
    </div>
  );
}

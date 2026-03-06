"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTabs } from "@/app/actions/queries";
import { Link as TransitionLink } from "next-view-transitions";
import { CreateTabForm } from "./create-tab-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TabsPage() {
  const { data: tabs, isLoading } = useQuery({
    queryKey: ["tabs"],
    queryFn: fetchTabs,
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your tabs</CardTitle>
            <CardDescription>
              Create a tab or select one to view
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CreateTabForm />
            {isLoading ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                Loading...
              </p>
            ) : !tabs || tabs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No tabs yet. Create one above.
              </p>
            ) : (
              <div className="space-y-2">
                {tabs.map((t) => (
                  <TransitionLink key={t.id} href={`/app/tabs/${t.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex items-center p-4">
                        <span className="font-medium">{t.name}</span>
                      </CardContent>
                    </Card>
                  </TransitionLink>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

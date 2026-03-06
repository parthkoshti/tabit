"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroups } from "@/app/actions/queries";
import { Link as TransitionLink } from "next-view-transitions";
import { CreateGroupForm } from "./create-group-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GroupsPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your groups</CardTitle>
            <CardDescription>Create a group or select one to view</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CreateGroupForm />
            {isLoading ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                Loading...
              </p>
            ) : !groups || groups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No groups yet. Create one above.
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <TransitionLink key={g.id} href={`/app/groups/${g.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex items-center p-4">
                        <span className="font-medium">{g.name}</span>
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

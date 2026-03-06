"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "@/app/actions/queries";
import { Link as TransitionLink } from "next-view-transitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDisplayName } from "@/lib/display-name";

function formatDate(d: Date) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export default function ActivityPage() {
  const { data: items, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: fetchActivity,
  });

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Recent expenses and settlements across your groups</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : !items || items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No activity yet
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item) =>
                item.type === "expense" ? (
                  <TransitionLink
                    key={`exp-${item.id}`}
                    href={`/app/groups/${item.groupId}`}
                  >
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.description}</span>
                          <span className="text-muted-foreground">
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getDisplayName({
                          username: item.paidByUsername,
                          name: item.paidByName,
                          email: item.paidByEmail,
                        })} paid in{" "}
                          {item.groupName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </TransitionLink>
                ) : (
                  <TransitionLink
                    key={`set-${item.id}`}
                    href={`/app/groups/${item.groupId}`}
                  >
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex flex-col gap-1 p-4">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {getDisplayName({
                              username: item.fromUserUsername,
                              name: item.fromUserName,
                              email: item.fromUserEmail,
                            })} paid{" "}
                            {getDisplayName({
                              username: item.toUserUsername,
                              name: item.toUserName,
                              email: item.toUserEmail,
                            })} $
                            {item.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Settlement in {item.groupName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </TransitionLink>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFriends } from "@/app/actions/queries";
import {
  getPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/app/actions/friends";
import { Link as TransitionLink } from "next-view-transitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDisplayName } from "@/lib/display-name";

export default function FriendsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: friends, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
  });
  const { data: requestsData } = useQuery({
    queryKey: ["pendingFriendRequests"],
    queryFn: async () => {
      const r = await getPendingFriendRequests();
      return r.success ? r.requests : [];
    },
  });
  const pendingRequests = requestsData ?? [];

  async function handleAccept(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    const result = await acceptFriendRequest(formData);
    if (result.success && result.friendGroupId) {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
      router.push(`/app/groups/${result.friendGroupId}`);
    }
  }

  async function handleReject(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    await rejectFriendRequest(formData);
    queryClient.invalidateQueries({ queryKey: ["pendingFriendRequests"] });
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {pendingRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Friend requests</CardTitle>
              <CardDescription>
                Accept or reject incoming requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {r.fromUserName ?? r.fromUserUsername ?? "Unknown"}
                    </span>
                    {r.fromUserUsername && (
                      <span className="text-sm text-muted-foreground">
                        @{r.fromUserUsername}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(r.id)}
                    >
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleAccept(r.id)}>
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your friends</CardTitle>
            <CardDescription>
              Tap to view split and add expenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                Loading...
              </p>
            ) : !friends || friends.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No friends yet. Use the add button above to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <TransitionLink key={f.id} href={`/app/groups/${f.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex items-center justify-between p-4">
                        <span className="font-medium">
                          {getDisplayName(f.friend)}
                        </span>
                        <span
                          className={
                            f.balance > 0
                              ? "text-green-600 dark:text-green-400"
                              : f.balance < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {f.balance > 0
                            ? `They owe you $${f.balance.toFixed(2)}`
                            : f.balance < 0
                              ? `You owe $${Math.abs(f.balance).toFixed(2)}`
                              : "Settled up"}
                        </span>
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

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTab } from "@/app/actions/queries";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useNavTitle } from "../../../context/nav-title-context";

export default function ManageTabPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId;
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
  });

  const currentUserId = session?.user?.id ?? "";
  const isAdmin = tab?.members?.find((m) => m.userId === currentUserId)?.role === "owner";

  useEffect(() => {
    setNavTitle?.({
      title: "Manage tab",
      backHref: `/tabs/${tabId}`,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, tabId]);

  if (!tabId) return null;

  if (tabLoading || !tab) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-md">
          <Alert variant="destructive">
            <AlertDescription>
              Only the tab admin can manage this tab.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <TransitionLink href={`/tabs/${tabId}`}>Back to tab</TransitionLink>
          </Button>
        </div>
      </div>
    );
  }

  if (tab.isDirect) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-md">
          <Alert variant="destructive">
            <AlertDescription>
              Direct tabs cannot be renamed.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <TransitionLink href={`/tabs/${tabId}`}>Back to tab</TransitionLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md">
        <RenameTabForm
          tabId={tabId}
          currentName={tab.name}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
            queryClient.invalidateQueries({ queryKey: ["tabs"] });
          }}
        />
      </div>
    </div>
  );
}

function RenameTabForm({
  tabId,
  currentName,
  onSuccess,
}: {
  tabId: string;
  currentName: string;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.tabs.update(tabId, name.trim());

    if (result.success) {
      toast.success("Tab renamed");
      onSuccess?.();
    } else {
      setError(result.error ?? "Failed to rename tab");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rename tab</CardTitle>
        <CardDescription>
          Change the name of this tab. All members will see the new name.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tab name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trip to NYC"
              required
              disabled={loading}
              autoComplete="off"
              maxLength={100}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading || name.trim() === currentName}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

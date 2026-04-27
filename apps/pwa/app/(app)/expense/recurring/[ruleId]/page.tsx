"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useNavTitle } from "../../../context/nav-title-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export function RecurringExpenseRulePage() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const id = ruleId ?? "";
  const setNavTitle = useNavTitle();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recurring-expense", id],
    queryFn: async () => {
      const r = await api.recurringExpenses.get(id);
      if (!r.success || !r.rule) throw new Error(r.error ?? "Failed to load");
      return r.rule;
    },
    enabled: !!id,
  });

  useEffect(() => {
    setNavTitle?.({ title: "Recurring expense", backHref: "/tabs" });
  }, [setNavTitle]);

  useEffect(() => {
    if (data) {
      setStatus(data.status);
    }
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await api.recurringExpenses.update(id, {
      status: status as "active" | "paused_user" | "paused_needs_fix",
    });
    setSaving(false);
    if (r.success) {
      toast.success("Saved");
      void queryClient.invalidateQueries({ queryKey: ["recurring-expense", id] });
    } else {
      toast.error(r.error ?? "Save failed");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this recurring rule? This is only allowed before any expense has been posted.")) {
      return;
    }
    const r = await api.recurringExpenses.delete(id);
    if (r.success) {
      toast.success("Rule deleted");
      window.history.back();
    } else {
      toast.error(r.error ?? "Delete failed");
    }
  }

  if (!id) {
    return <p className="p-4 text-sm text-muted-foreground">Invalid rule</p>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : "Could not load rule"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-24">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to={`/tabs/${data.tabId}`}>
          <ArrowLeft className="size-4" />
          Back to tab
        </Link>
      </Button>

      {data.status === "paused_needs_fix" ? (
        <Alert variant="destructive">
          <AlertDescription>
            This rule is paused until you fix the template or members so the next
            expense can post.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.template &&
      typeof data.template === "object" &&
      data.template !== null &&
      "description" in data.template ? (
        <p className="text-sm text-muted-foreground">
          {String((data.template as { description: string }).description)}
        </p>
      ) : null}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused_user">Paused</SelectItem>
              {data.status === "paused_needs_fix" ? (
                <SelectItem value="paused_needs_fix" disabled>
                  Paused (needs fix)
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Posted {data.postedCount}
          {data.maxCount != null ? ` / ${data.maxCount}` : ""}. Next due:{" "}
          {data.nextDueKey}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>

      {data.postedCount === 0 ? (
        <Button type="button" variant="outline" onClick={handleDelete}>
          Delete rule
        </Button>
      ) : null}
    </div>
  );
}

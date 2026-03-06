"use client";

import { useState } from "react";
import { createTab } from "@/app/actions/tabs";
import { useTransitionRouter } from "next-view-transitions";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateTabForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useTransitionRouter();
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name);

    const result = await createTab(formData);

    if (result.success && result.tabId) {
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      router.push(`/app/tabs/${result.tabId}`);
    } else {
      setError(result.error ?? "Failed to create tab");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tab name"
          required
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create tab"}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

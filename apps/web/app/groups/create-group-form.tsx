"use client";

import { useState } from "react";
import { createGroup } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateGroupForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name);

    const result = await createGroup(formData);

    if (result.success && result.groupId) {
      router.push(`/groups/${result.groupId}`);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to create group");
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
          placeholder="Group name"
          required
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create group"}
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

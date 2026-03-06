"use client";

import { useState } from "react";
import { createExpense } from "@/app/actions/expenses";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDisplayName } from "@/lib/display-name";

type Member = {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string | null; username?: string | null };
};

export function AddExpenseForm({
  tabId,
  members,
  currentUserId,
}: {
  tabId: string;
  members: Member[];
  currentUserId: string;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidById, setPaidById] = useState(currentUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("tabId", tabId);
    formData.set("amount", amount);
    formData.set("description", description);
    formData.set("paidById", paidById);
    formData.set("splitType", "equal");

    const result = await createExpense(formData);

    if (result.success) {
      setAmount("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    } else {
      setError(result.error ?? "Failed to add expense");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner"
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label>Paid by</Label>
        <Select
          value={paidById}
          onValueChange={setPaidById}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select who paid" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {getDisplayName(m.user, currentUserId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Split equally among {members.length} member
        {members.length !== 1 ? "s" : ""}
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add expense"}
      </Button>
    </form>
  );
}

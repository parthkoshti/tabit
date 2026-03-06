"use client";

import { useState } from "react";
import { recordSettlement } from "@/app/actions/settlements";
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

type Balance = {
  userId: string;
  amount: number;
  user: { id: string; email: string; name: string | null; username?: string | null };
};

export function SettleUpForm({
  groupId,
  currentUserId,
  balances,
}: {
  groupId: string;
  currentUserId: string;
  balances: Balance[];
}) {
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const myBalance = balances.find((b) => b.userId === currentUserId);
  const iOwe = myBalance && myBalance.amount < 0;
  const payees = balances.filter(
    (b) => b.userId !== currentUserId && b.amount > 0
  );
  const canSettle = iOwe && payees.length > 0;

  if (!canSettle) {
    return (
      <p className="rounded-lg border border-border p-4 text-muted-foreground">
        You have no debts to settle in this group.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId) {
      setError("Please select a person to pay back");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("fromUserId", currentUserId);
    formData.set("toUserId", toUserId);
    formData.set("amount", amount);

    const result = await recordSettlement(formData);

    if (result.success) {
      setToUserId("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    } else {
      setError(result.error ?? "Failed to record settlement");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Pay back</Label>
        <Select
          value={toUserId || undefined}
          onValueChange={(value) => {
            setToUserId(value);
            const b = payees.find((x) => x.userId === value);
            if (b)
              setAmount(
                Math.min(
                  b.amount,
                  myBalance ? Math.abs(myBalance.amount) : b.amount
                ).toFixed(2)
              );
          }}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select person" />
          </SelectTrigger>
          <SelectContent>
            {payees.map((b) => (
              <SelectItem key={b.userId} value={b.userId}>
                {getDisplayName(b.user)} (owed ${b.amount.toFixed(2)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={loading} variant="secondary">
        {loading ? "Recording..." : "Record settlement"}
      </Button>
    </form>
  );
}

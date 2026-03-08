"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
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
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";

type Member = {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string | null; username?: string | null };
};

type Balance = {
  userId: string;
  amount: number;
  user: { id: string; email: string; name: string | null; username?: string | null };
};

export function SettleUpForm({
  tabId,
  currentUserId,
  members,
  balances,
  onSuccess,
}: {
  tabId: string;
  currentUserId: string;
  members: Member[];
  balances: Balance[];
  onSuccess?: () => void;
}) {
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const balanceMap = Object.fromEntries(
    balances.map((b) => [b.userId, b.amount])
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromUserId || !toUserId) {
      setError("Please select both payer and payee");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await api.settlements.record(
      tabId,
      fromUserId,
      toUserId,
      parseFloat(amount)
    );

    if (result.success) {
      setFromUserId("");
      setToUserId("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Settlement recorded");
      onSuccess?.();
    } else {
      setError(result.error ?? "Failed to record settlement");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Paid by</Label>
        <Select
          value={fromUserId || undefined}
          onValueChange={(value) => {
            setFromUserId(value);
            setToUserId("");
            setAmount("");
          }}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select who paid" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                <span className="flex items-center gap-2">
                  <UserAvatar userId={m.userId} size="sm" />
                  {getDisplayName(m.user, currentUserId)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Paid to</Label>
        <Select
          value={toUserId || undefined}
          onValueChange={(value) => {
            setToUserId(value);
            const owed = balanceMap[value] ?? 0;
            if (owed > 0) setAmount(owed.toFixed(2));
          }}
          disabled={loading || !fromUserId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select who received" />
          </SelectTrigger>
          <SelectContent>
            {members
              .filter((m) => m.userId !== fromUserId)
              .map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <span className="flex items-center gap-2">
                    <UserAvatar userId={m.userId} size="sm" />
                    {getDisplayName(m.user, currentUserId)}
                    {(balanceMap[m.userId] ?? 0) > 0 && (
                      <> (owed ${(balanceMap[m.userId] ?? 0).toFixed(2)})</>
                    )}
                  </span>
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
          className="input-no-spinner"
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

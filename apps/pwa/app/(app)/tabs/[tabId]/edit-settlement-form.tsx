import { useState } from "react";
import { api } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CornerDownLeft, Trash2 } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";

type Member = {
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

type Settlement = {
  id: string;
  tabId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  createdAt: Date | string;
  fromUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  toUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export function EditSettlementForm({
  settlementId,
  tabId,
  settlement,
  members,
  currentUserId,
  onSuccess,
  onDeleteSuccess,
  onCancel,
}: {
  settlementId: string;
  tabId: string;
  settlement: Settlement;
  members: Member[];
  currentUserId: string;
  onSuccess?: () => void;
  onDeleteSuccess?: () => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [fromUserId, setFromUserId] = useState(settlement.fromUserId);
  const [toUserId, setToUserId] = useState(settlement.toUserId);
  const [amount, setAmount] = useState(settlement.amount.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function parseAmount(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.01) return null;
    return num;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      setError("Please enter a valid amount (min $0.01)");
      setLoading(false);
      return;
    }

    if (fromUserId === toUserId) {
      setError("Payer and payee must be different people");
      setLoading(false);
      return;
    }

    const result = await api.settlements.update(tabId, settlementId, {
      fromUserId,
      toUserId,
      amount: parsedAmount,
    });

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["settlement", settlementId] });
      toast.success("Settlement updated");
      if (onSuccess) onSuccess();
      else navigate(`/tabs/${tabId}`);
    } else {
      setError(result.error ?? "Failed to update settlement");
    }
    setLoading(false);
  }

  async function handleDelete() {
    setDeleteOpen(false);
    setLoading(true);
    const result = await api.settlements.delete(tabId, settlementId);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Settlement deleted");
      const cb = onDeleteSuccess ?? onSuccess;
      if (cb) cb();
      else navigate(`/tabs/${tabId}`);
    } else {
      setError(result.error ?? "Failed to delete settlement");
    }
    setLoading(false);
  }

  const otherMembers = members.filter((m) => m.userId !== fromUserId);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Paid by</Label>
          <Select
            value={fromUserId}
            onValueChange={(v) => {
              setFromUserId(v);
              if (toUserId === v) setToUserId("");
            }}
            disabled={loading}
          >
            <SelectTrigger className="[&>span]:line-clamp-none" hideChevron>
              <SelectValue placeholder="Select who paid">
                {(() => {
                  const payer = members.find((m) => m.userId === fromUserId);
                  return payer ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={payer.userId} size="xs" />
                      {getDisplayName(payer.user, currentUserId)}
                    </span>
                  ) : null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <span className="flex items-center gap-2">
                    <UserAvatar userId={m.userId} size="xs" />
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
            value={toUserId}
            onValueChange={setToUserId}
            disabled={loading || !fromUserId}
          >
            <SelectTrigger className="[&>span]:line-clamp-none" hideChevron>
              <SelectValue placeholder="Select who received">
                {(() => {
                  const payee = members.find((m) => m.userId === toUserId);
                  return payee ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={payee.userId} size="xs" />
                      {getDisplayName(payee.user, currentUserId)}
                    </span>
                  ) : null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {otherMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <span className="flex items-center gap-2">
                    <UserAvatar userId={m.userId} size="xs" />
                    {getDisplayName(m.user, currentUserId)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <div className="flex h-12 items-center rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
            <span className="pl-3 text-base text-muted-foreground">$</span>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
              }}
              onBlur={() => {
                const num = parseFloat(amount);
                if (!isNaN(num) && num > 0) setAmount(num.toFixed(2));
              }}
              placeholder="0.00"
              required
              disabled={loading}
              className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? "Saving..." : "Save"}
            <CornerDownLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={onCancel}
                className="w-full"
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={loading}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </form>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this settlement and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

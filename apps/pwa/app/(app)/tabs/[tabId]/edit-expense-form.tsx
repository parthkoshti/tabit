import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatAbsoluteDate } from "@/lib/format-date";
import { Calendar as CalendarIcon, CornerDownLeft, Trash2 } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type Expense = {
  id: string;
  tabId: string;
  paidById: string;
  amount: number;
  description: string;
  splitType: string;
  expenseDate: Date | string;
  paidBy: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  splits: {
    userId: string;
    amount: number;
    user: { id: string; email: string; name: string | null };
  }[];
};

export function EditExpenseForm({
  expenseId,
  tabId,
  expense,
  members,
  currentUserId,
  onSuccess,
  onDeleteSuccess,
  onCancel,
}: {
  expenseId: string;
  tabId: string;
  expense: Expense;
  members: Member[];
  currentUserId: string;
  onSuccess?: () => void;
  onDeleteSuccess?: () => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(expense.amount.toFixed(2));
  const [description, setDescription] = useState(expense.description);
  const [expenseDate, setExpenseDate] = useState<Date>(
    () => new Date(expense.expenseDate),
  );
  const [paidById, setPaidById] = useState(expense.paidById);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(expense.splits.map((s) => s.userId)),
  );
  const [loading, setLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = descriptionRef.current;
    if (input) {
      const id = setTimeout(() => input.focus(), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const selectedParticipants = useMemo(
    () => members.filter((m) => participantIds.has(m.userId)),
    [members, participantIds],
  );

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size <= 1) {
          setError("At least one person must be in the split");
          return prev;
        }
        next.delete(userId);
      } else {
        next.add(userId);
        setError(null);
      }
      return next;
    });
  }
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

    if (selectedParticipants.length < 1) {
      setError("At least one person must be in the split");
      setLoading(false);
      return;
    }

    if (
      selectedParticipants.length === 1 &&
      selectedParticipants[0].userId === paidById
    ) {
      setError("Payer cannot be the only member of the split");
      setLoading(false);
      return;
    }

    const result = await api.expenses.update(tabId, expenseId, {
      amount: parsedAmount,
      description,
      paidById,
      splitType: "equal",
      expenseDate: expenseDate.toISOString().slice(0, 10),
      participantIds: selectedParticipants.map((p) => p.userId),
    });

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["expense", expenseId] });
      toast.success("Expense updated");
      if (onSuccess) onSuccess();
      else navigate(`/tabs/${tabId}`);
    } else {
      setError(result.error ?? "Failed to update expense");
    }
    setLoading(false);
  }

  async function handleDelete() {
    setDeleteOpen(false);
    setLoading(true);
    const result = await api.expenses.delete(tabId, expenseId);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Expense deleted");
      const cb = onDeleteSuccess ?? onSuccess;
      if (cb) cb();
      else navigate(`/tabs/${tabId}`);
    } else {
      setError(result.error ?? "Failed to delete expense");
    }
    setLoading(false);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Select
            value={paidById}
            onValueChange={setPaidById}
            disabled={loading}
          >
            <SelectTrigger className="flex-1 min-w-0 [&>span]:line-clamp-none">
              <SelectValue placeholder="Select who paid">
                {(() => {
                  const payer = members.find((m) => m.userId === paidById);
                  return payer ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={payer.userId} size="xs" />
                      {getDisplayName(payer.user, currentUserId)}
                      <span className="text-muted-foreground">paid</span>
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
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={loading}
                className={cn(
                  "h-9 shrink-0 gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
                  !expenseDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {expenseDate ? formatAbsoluteDate(expenseDate) : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto min-w-72 rounded-lg border-border p-0 shadow-md overflow-clip"
              align="end"
              sideOffset={4}
            >
              <Calendar
                mode="single"
                selected={expenseDate}
                className="w-full"
                onSelect={(date) => {
                  if (date) {
                    setExpenseDate(date);
                    setDatePickerOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Split with</Label>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => toggleParticipant(m.userId)}
                disabled={loading}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  participantIds.has(m.userId)
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <UserAvatar userId={m.userId} size="xs" />
                <span className="min-w-0 truncate">
                  {getDisplayName(m.user, currentUserId)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedParticipants.length === 1
              ? "1 person owes the full amount"
              : `Split equally among ${selectedParticipants.length} participants`}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex h-12 items-center rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
            <span className="pl-3 text-base text-muted-foreground">For</span>
            <Input
              ref={descriptionRef}
              id="description"
              type="text"
              autoComplete="off"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="eg. Dinner"
              required
              disabled={loading}
              className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
          </div>
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
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the expense from the tab. You can restore it later.
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

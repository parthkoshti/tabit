"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
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

export function AddExpenseForm({
  tabId,
  members,
  currentUserId,
  onSuccess,
}: {
  tabId: string;
  members: Member[];
  currentUserId: string;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(() => new Date());
  const [paidById, setPaidById] = useState(currentUserId);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId)),
  );

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
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
        if (next.size <= 1) return prev;
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

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

    if (selectedParticipants.length === 0) {
      setError("Select at least one participant");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.set("tabId", tabId);
    formData.set("amount", parsedAmount.toFixed(2));
    formData.set("description", description);
    formData.set("expenseDate", expenseDate.toISOString().slice(0, 10));
    formData.set("paidById", paidById);
    formData.set("splitType", "equal");
    formData.set(
      "participantIds",
      JSON.stringify(selectedParticipants.map((p) => p.userId)),
    );

    const result = await createExpense(formData);

    if (result.success) {
      setAmount("");
      setDescription("");
      setExpenseDate(new Date());
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Expense added");
      onSuccess?.();
    } else {
      setError(result.error ?? "Failed to add expense");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <Select value={paidById} onValueChange={setPaidById} disabled={loading}>
          <SelectTrigger className="flex-1 min-w-0">
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
                "h-9 shrink-0 justify-between gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
                !expenseDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              {expenseDate ? format(expenseDate, "MMM d") : "Date"}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
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
          Split equally among {selectedParticipants.length} participant
          {selectedParticipants.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex h-12 items-center rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
          <span className="pl-3 text-base text-muted-foreground">For</span>
          <Input
            ref={descriptionRef}
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dinner"
            required
            disabled={loading}
            className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
      </div>
      <div className="space-y-2">
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
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add expense"}
      </Button>
    </form>
  );
}

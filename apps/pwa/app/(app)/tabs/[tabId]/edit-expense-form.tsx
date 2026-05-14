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
import {
  Calendar,
  CALENDAR_POPOVER_CONTENT_CLASSNAME,
} from "@/components/ui/calendar";
import { formatAbsoluteDate } from "@/lib/format-date";
import { Calendar as CalendarIcon, CornerDownLeft, Trash2 } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CURATED_CURRENCIES, getCurrency } from "shared";
import { formatAmount } from "@/lib/format-amount";
import {
  SplitDialog,
  splitConfigLabel,
  type SplitConfig,
} from "@/components/split-dialog";

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

type TabParticipant = {
  id: string;
  kind: string;
  userId: string | null;
  displayName: string;
  user: Member["user"] | null;
};

type Expense = {
  id: string;
  tabId: string;
  paidById: string | null;
  paidByParticipantId?: string | null;
  amount: number;
  currency?: string;
  originalAmount?: number;
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
    userId: string | null;
    participantId: string | null;
    amount: number;
    weight?: number | null;
    user: { id: string; email: string; name: string | null };
  }[];
};

function splitRowKey(s: Expense["splits"][0]): string {
  return s.participantId ?? s.userId ?? "";
}

function participantLabel(p: TabParticipant, currentUserId: string): string {
  const base = p.user
    ? getDisplayName(p.user, currentUserId)
    : p.displayName;
  return p.kind === "placeholder" ? `${base} (placeholder)` : base;
}

function inferSplitConfig(expense: Expense): SplitConfig | null {
  if (expense.splitType === "equal") return null;
  if (
    expense.splitType === "percent" &&
    expense.splits.every((s) => s.weight != null)
  ) {
    return {
      splitType: "percent",
      splits: expense.splits.map((s) => ({
        userId: splitRowKey(s),
        weight: s.weight as number,
      })),
    };
  }
  if (
    expense.splitType === "shares" &&
    expense.splits.every((s) => s.weight != null)
  ) {
    return {
      splitType: "shares",
      splits: expense.splits.map((s) => ({
        userId: splitRowKey(s),
        weight: s.weight as number,
      })),
    };
  }
  const amounts = expense.splits.map((s) => s.amount);
  const allEqual =
    amounts.length > 0 && amounts.every((a) => a === amounts[0]);
  if (allEqual) return null;
  return {
    splitType: "custom",
    splits: expense.splits.map((s) => ({
      userId: splitRowKey(s),
      amount: s.amount,
    })),
  };
}

export function EditExpenseForm({
  expenseId,
  tabId,
  tabCurrency,
  expense,
  members,
  participants,
  currentUserId,
  onSuccess,
  onDeleteSuccess,
  onCancel,
}: {
  expenseId: string;
  tabId: string;
  tabCurrency: string;
  expense: Expense;
  members: Member[];
  participants: TabParticipant[];
  currentUserId: string;
  onSuccess?: () => void;
  onDeleteSuccess?: () => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(() =>
    (expense.originalAmount ?? expense.amount).toFixed(2),
  );
  const [currency, setCurrency] = useState(
    expense.currency ?? tabCurrency,
  );
  const [description, setDescription] = useState(expense.description);
  const [expenseDate, setExpenseDate] = useState<Date>(
    () => new Date(expense.expenseDate),
  );
  const [paidByParticipantId, setPaidByParticipantId] = useState("");
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const [fxPreview, setFxPreview] = useState<{
    amountTab: number;
    tabCurrency: string;
  } | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(() =>
    inferSplitConfig(expense),
  );
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);

  const tabParticipants = useMemo((): TabParticipant[] => {
    if (participants.length > 0) return participants;
    return members.map((m) => ({
      id: m.userId,
      kind: "member",
      userId: m.userId,
      displayName:
        m.user.name?.trim() ||
        (m.user.username ? `@${m.user.username}` : "") ||
        m.user.email,
      user: m.user,
    }));
  }, [participants, members]);

  useEffect(() => {
    if (tabParticipants.length === 0) return;
    setSplitConfig(inferSplitConfig(expense));
    const initPayer =
      expense.paidByParticipantId ??
      tabParticipants.find((p) => p.userId != null && p.userId === expense.paidById)
        ?.id ??
      tabParticipants.find((p) => p.id === expense.paidById)?.id ??
      tabParticipants[0]!.id;
    setPaidByParticipantId(initPayer);
    setParticipantIds(
      new Set(
        expense.splits
          .map((s) => splitRowKey(s))
          .filter((id) => id.length > 0),
      ),
    );
  }, [expense, tabParticipants]);

  function parseAmount(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.01) return null;
    return num;
  }

  useEffect(() => {
    const parsed = parseAmount(amount);
    if (parsed === null || currency === tabCurrency) {
      setFxPreview(null);
      setFxPreviewLoading(false);
      return;
    }

    setFxPreview(null);
    setFxPreviewLoading(true);

    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        const r = await api.expenses.fxPreview(tabId, {
          amount: parsed,
          currency,
          expenseDate: expenseDate.toISOString(),
        });
        if (cancelled) return;
        setFxPreviewLoading(false);
        if (r.success && r.amountTab != null) {
          setFxPreview({
            amountTab: r.amountTab,
            tabCurrency: r.tabCurrency ?? tabCurrency,
          });
        } else {
          setFxPreview(null);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, currency, expenseDate, tabId, tabCurrency]);

  useEffect(() => {
    const input = descriptionRef.current;
    if (input) {
      const id = setTimeout(() => input.focus(), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const selectedParticipants = useMemo(
    () => tabParticipants.filter((p) => participantIds.has(p.id)),
    [tabParticipants, participantIds],
  );

  const hasPlaceholderInSplit = useMemo(
    () => selectedParticipants.some((p) => p.kind === "placeholder"),
    [selectedParticipants],
  );

  const splitDialogParticipants = useMemo(
    () =>
      selectedParticipants.map((p) => ({
        userId: p.userId ?? p.id,
        user:
          p.user ??
          ({
            id: p.id,
            email: "",
            name: p.displayName,
            username: null,
          } as Member["user"]),
      })),
    [selectedParticipants],
  );

  const parsedAmountForSplit = useMemo(() => parseAmount(amount), [amount]);

  const tabTotalForSplit = useMemo(() => {
    if (parsedAmountForSplit === null) return null;
    if (currency === tabCurrency) return parsedAmountForSplit;
    return fxPreview?.amountTab ?? null;
  }, [parsedAmountForSplit, currency, tabCurrency, fxPreview?.amountTab]);

  const splitButtonDisabled =
    parsedAmountForSplit === null ||
    (currency !== tabCurrency && (fxPreviewLoading || tabTotalForSplit === null));

  function toggleParticipant(participantId: string) {
    setSplitConfig(null);
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        if (next.size <= 1) {
          setError("At least one person must be in the split");
          return prev;
        }
        next.delete(participantId);
      } else {
        next.add(participantId);
        setError(null);
      }
      return next;
    });
  }
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
      selectedParticipants[0]!.id === paidByParticipantId
    ) {
      setError("Payer cannot be the only member of the split");
      setLoading(false);
      return;
    }

    const participantIdsList = selectedParticipants.map((p) => p.id);

    const updateBody =
      splitConfig == null || splitConfig.splitType === "equal"
        ? {
            amount: parsedAmount,
            currency,
            description,
            paidByParticipantId,
            splitType: "equal" as const,
            expenseDate: expenseDate.toISOString().slice(0, 10),
            participantIds: participantIdsList,
          }
        : splitConfig.splitType === "custom"
          ? {
              amount: parsedAmount,
              currency,
              description,
              paidByParticipantId,
              splitType: "custom" as const,
              expenseDate: expenseDate.toISOString().slice(0, 10),
              participantIds: participantIdsList,
              splits: splitConfig.splits,
            }
          : {
              amount: parsedAmount,
              currency,
              description,
              paidByParticipantId,
              splitType: splitConfig.splitType,
              expenseDate: expenseDate.toISOString().slice(0, 10),
              participantIds: participantIdsList,
              splits: splitConfig.splits.map((s) => ({
                userId: s.userId,
                weight: s.weight,
              })),
            };

    const result = await api.expenses.update(tabId, expenseId, updateBody);

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({
        queryKey: ["expense", tabId, expenseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenseAuditLog", tabId, expenseId],
      });
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
      {tabTotalForSplit != null && parsedAmountForSplit != null ? (
        <SplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          participants={splitDialogParticipants}
          tabTotal={tabTotalForSplit}
          expenseTotal={parsedAmountForSplit}
          expenseCurrency={currency}
          tabCurrency={tabCurrency}
          currentUserId={currentUserId}
          initialConfig={splitConfig}
          onConfirm={setSplitConfig}
        />
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Select
            value={paidByParticipantId}
            onValueChange={setPaidByParticipantId}
            disabled={loading}
          >
            <SelectTrigger className="flex-1 min-w-0 [&>span]:line-clamp-none">
              <SelectValue placeholder="Select who paid">
                {(() => {
                  const payer = tabParticipants.find(
                    (p) => p.id === paidByParticipantId,
                  );
                  return payer ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar
                        userId={payer.userId ?? payer.id}
                        size="xs"
                      />
                      {participantLabel(payer, currentUserId)}
                      <span className="text-muted-foreground">paid</span>
                    </span>
                  ) : null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tabParticipants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <UserAvatar userId={p.userId ?? p.id} size="xs" />
                    {participantLabel(p, currentUserId)}
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
              className={CALENDAR_POPOVER_CONTENT_CLASSNAME}
              align="end"
              sideOffset={4}
              collisionPadding={12}
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
            {tabParticipants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleParticipant(p.id)}
                disabled={loading}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  participantIds.has(p.id)
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <UserAvatar userId={p.userId ?? p.id} size="xs" />
                <span className="min-w-0 truncate">
                  {participantLabel(p, currentUserId)}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={
              loading || splitButtonDisabled || hasPlaceholderInSplit
            }
            onClick={() => setSplitDialogOpen(true)}
          >
            {splitConfigLabel(splitConfig)}
          </Button>
          <p className="text-xs text-muted-foreground">
            {selectedParticipants.length === 1
              ? "1 person owes the full amount"
              : splitConfig == null || splitConfig.splitType === "equal"
                ? `Split equally among ${selectedParticipants.length} participants`
                : splitConfig.splitType === "shares"
                  ? `Split by shares among ${selectedParticipants.length} participants`
                  : splitConfig.splitType === "percent"
                    ? `Split by % among ${selectedParticipants.length} participants`
                    : `Custom amounts for ${selectedParticipants.length} participants`}
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
          <div className="flex gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
              <span className="pl-3 text-base text-muted-foreground">
                {getCurrency(currency)?.symbol ?? currency}
              </span>
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
            <Select
              value={currency}
              onValueChange={setCurrency}
              disabled={loading}
            >
              <SelectTrigger className="h-12 w-[min(7.5rem,28vw)] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CURATED_CURRENCIES.map((code) => {
                  const c = getCurrency(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {code}
                      {c?.symbol ? ` (${c.symbol})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {currency !== tabCurrency &&
            parseAmount(amount) != null &&
            (fxPreviewLoading ? (
              <Skeleton className="mt-0.5 h-4 w-[min(100%,12rem)]" />
            ) : (
              fxPreview && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatAmount(fxPreview.amountTab, fxPreview.tabCurrency)} in
                  tab currency
                </p>
              )
            ))}
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

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar,
  CALENDAR_POPOVER_CONTENT_CLASSNAME,
} from "@/components/ui/calendar";
import { formatRelativeCalendarDate } from "@/lib/format-date";
import {
  Calendar as CalendarIcon,
  CalendarSync,
  CornerDownLeft,
  Split,
} from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { CURATED_CURRENCIES, getCurrency } from "shared";
import type { PendingRecurringRuleWithoutTemplate } from "models";
import { formatAmount } from "@/lib/format-amount";
import {
  ExpenseAddedDialog,
  type ExpenseCreatedCloseReason,
} from "@/components/expense-added-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SplitDialog,
  splitConfigLabel,
  type SplitConfig,
} from "@/components/split-dialog";
import {
  MakeRecurringExpenseDialog,
  type RecurringTemplatePayload,
} from "@/components/make-recurring-expense-dialog";

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
  tabCurrency,
  members,
  currentUserId,
  onSuccess,
  onExpenseCreated,
}: {
  tabId: string;
  tabCurrency: string;
  members: Member[];
  currentUserId: string;
  onSuccess?: () => void;
  /** Called once the expense is saved (before the success dialog). Use to refresh lists outside this tab. */
  onExpenseCreated?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(tabCurrency);
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(() => new Date());
  const [paidById, setPaidById] = useState(currentUserId);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId)),
  );

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdExpense, setCreatedExpense] = useState<{
    expenseId: string;
    tabId: string;
    amount: number;
    description: string;
    tabName: string;
    currency?: string;
    participants: Array<{
      userId: string;
      name: string | null;
      paid?: number;
      owes?: number;
    }>;
  } | null>(null);
  const [partialSuccessOpen, setPartialSuccessOpen] = useState(false);
  const skipPartialSheetClose = useRef(false);
  const queryClient = useQueryClient();
  const descriptionRef = useRef<HTMLInputElement>(null);

  const [fxPreview, setFxPreview] = useState<{
    amountTab: number;
    tabCurrency: string;
  } | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [recurringSetupOpen, setRecurringSetupOpen] = useState(false);
  const [recurringTemplate, setRecurringTemplate] =
    useState<RecurringTemplatePayload | null>(null);
  const [pendingRecurring, setPendingRecurring] =
    useState<PendingRecurringRuleWithoutTemplate | null>(null);

  function parseAmount(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.01) return null;
    return num;
  }

  useEffect(() => {
    setCurrency(tabCurrency);
  }, [tabCurrency]);

  useEffect(() => {
    const input = descriptionRef.current;
    if (input) {
      const id = setTimeout(() => input.focus(), 0);
      return () => clearTimeout(id);
    }
  }, []);

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

  const selectedParticipants = useMemo(
    () => members.filter((m) => participantIds.has(m.userId)),
    [members, participantIds],
  );

  const parsedAmountForSplit = useMemo(() => parseAmount(amount), [amount]);

  const tabTotalForSplit = useMemo(() => {
    if (parsedAmountForSplit === null) return null;
    if (currency === tabCurrency) return parsedAmountForSplit;
    return fxPreview?.amountTab ?? null;
  }, [parsedAmountForSplit, currency, tabCurrency, fxPreview?.amountTab]);

  const splitButtonDisabled =
    parsedAmountForSplit === null ||
    (currency !== tabCurrency &&
      (fxPreviewLoading || tabTotalForSplit === null));

  function prepareRecurringTemplate():
    | { ok: true; template: RecurringTemplatePayload }
    | { ok: false; error: string } {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      return { ok: false, error: "Please enter a valid amount (min $0.01)" };
    }
    if (!description.trim()) {
      return { ok: false, error: "Please add a description" };
    }
    if (selectedParticipants.length < 1) {
      return { ok: false, error: "At least one person must be in the split" };
    }
    if (
      selectedParticipants.length === 1 &&
      selectedParticipants[0].userId === paidById
    ) {
      return {
        ok: false,
        error: "Payer cannot be the only member of the split",
      };
    }
    if (splitButtonDisabled) {
      return {
        ok: false,
        error:
          currency !== tabCurrency && fxPreviewLoading
            ? "Wait for the exchange rate preview to finish"
            : "Enter a valid amount or wait for tab-currency conversion",
      };
    }
    const participantIdsList = selectedParticipants.map((p) => p.userId);
    const template: RecurringTemplatePayload =
      splitConfig == null || splitConfig.splitType === "equal"
        ? {
            amount: parsedAmount,
            currency,
            description,
            paidById,
            splitType: "equal",
            participantIds: participantIdsList,
          }
        : splitConfig.splitType === "custom"
          ? {
              amount: parsedAmount,
              currency,
              description,
              paidById,
              splitType: "custom",
              participantIds: participantIdsList,
              splits: splitConfig.splits,
            }
          : {
              amount: parsedAmount,
              currency,
              description,
              paidById,
              splitType: splitConfig.splitType,
              participantIds: participantIdsList,
              splits: splitConfig.splits.map((s) => ({
                userId: s.userId,
                weight: s.weight,
              })),
            };
    return { ok: true, template };
  }

  const makeRecurringDisabled = useMemo(
    () =>
      loading ||
      parseAmount(amount) === null ||
      !description.trim() ||
      selectedParticipants.length < 1 ||
      (selectedParticipants.length === 1 &&
        selectedParticipants[0].userId === paidById) ||
      splitButtonDisabled,
    [
      loading,
      amount,
      description,
      selectedParticipants,
      paidById,
      splitButtonDisabled,
    ],
  );

  function handleMakeRecurringClick() {
    setError(null);
    const prep = prepareRecurringTemplate();
    if (!prep.ok) {
      setError(prep.error);
      return;
    }
    setRecurringTemplate(prep.template);
    setRecurringSetupOpen(true);
  }

  function toggleParticipant(userId: string) {
    setSplitConfig(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const prep = prepareRecurringTemplate();
    if (!prep.ok) {
      setError(prep.error);
      setLoading(false);
      return;
    }
    const parsedAmount = prep.template.amount;
    const participantIdsList = prep.template.participantIds;

    const createBody =
      splitConfig == null || splitConfig.splitType === "equal"
        ? {
            amount: parsedAmount,
            currency,
            description,
            paidById,
            splitType: "equal" as const,
            participantIds: participantIdsList,
            expenseDate: expenseDate.toISOString(),
          }
        : splitConfig.splitType === "custom"
          ? {
              amount: parsedAmount,
              currency,
              description,
              paidById,
              splitType: "custom" as const,
              participantIds: participantIdsList,
              splits: splitConfig.splits,
              expenseDate: expenseDate.toISOString(),
            }
          : {
              amount: parsedAmount,
              currency,
              description,
              paidById,
              splitType: splitConfig.splitType,
              participantIds: participantIdsList,
              splits: splitConfig.splits.map((s) => ({
                userId: s.userId,
                weight: s.weight,
              })),
              expenseDate: expenseDate.toISOString(),
            };

    const createRecurringRule = pendingRecurring
      ? { ...pendingRecurring, template: prep.template }
      : undefined;

    const result = await api.expenses.create(tabId, {
      ...createBody,
      ...(createRecurringRule ? { createRecurringRule } : {}),
    });

    if (
      result.success &&
      result.expenseId &&
      result.tabId &&
      result.amount != null &&
      result.description &&
      result.tabName
    ) {
      setAmount("");
      setDescription("");
      setExpenseDate(new Date());
      setCurrency(tabCurrency);
      setSplitConfig(null);
      setPendingRecurring(null);
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({
        queryKey: ["recurring-expenses", tabId],
      });
      onExpenseCreated?.();
      setCreatedExpense({
        expenseId: result.expenseId,
        tabId: result.tabId,
        amount: result.amount,
        description: result.description,
        tabName: result.tabName,
        currency: result.currency,
        participants: result.participants ?? [],
      });
    } else if (result.success) {
      setAmount("");
      setDescription("");
      setExpenseDate(new Date());
      setCurrency(tabCurrency);
      setSplitConfig(null);
      setPendingRecurring(null);
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({
        queryKey: ["recurring-expenses", tabId],
      });
      onExpenseCreated?.();
      setPartialSuccessOpen(true);
    } else {
      setError(result.error ?? "Failed to add expense");
    }
    setLoading(false);
  }

  function handleCreatedClose(reason: ExpenseCreatedCloseReason) {
    setCreatedExpense(null);
    // "edit" navigates in ExpenseAddedDialog; onSuccess would navigate("/tabs") and override that.
    if (reason === "dismiss") {
      onSuccess?.();
    }
    if (reason === "add-another") {
      queueMicrotask(() => descriptionRef.current?.focus());
    }
  }

  return (
    <>
      {tabTotalForSplit != null && parsedAmountForSplit != null ? (
        <SplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          participants={selectedParticipants}
          tabTotal={tabTotalForSplit}
          expenseTotal={parsedAmountForSplit}
          expenseCurrency={currency}
          tabCurrency={tabCurrency}
          currentUserId={currentUserId}
          initialConfig={splitConfig}
          onConfirm={setSplitConfig}
        />
      ) : null}
      <ExpenseAddedDialog
        open={!!createdExpense}
        onOpenChange={(open) => {
          if (!open) setCreatedExpense(null);
        }}
        expenseId={createdExpense?.expenseId ?? ""}
        tabId={createdExpense?.tabId ?? ""}
        amount={createdExpense?.amount ?? 0}
        description={createdExpense?.description ?? ""}
        tabName={createdExpense?.tabName ?? ""}
        currency={createdExpense?.currency}
        participants={createdExpense?.participants ?? []}
        currentUserId={currentUserId}
        onCloseReason={handleCreatedClose}
      />
      <MakeRecurringExpenseDialog
        open={recurringSetupOpen}
        onOpenChange={(open) => {
          setRecurringSetupOpen(open);
          if (!open) {
            setRecurringTemplate(null);
          }
        }}
        template={recurringTemplate}
        draft={pendingRecurring}
        onConfirm={setPendingRecurring}
      />
      <Dialog
        open={partialSuccessOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPartialSuccessOpen(false);
            if (!skipPartialSheetClose.current) {
              onSuccess?.();
            }
            skipPartialSheetClose.current = false;
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Expense added</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                skipPartialSheetClose.current = true;
                setPartialSuccessOpen(false);
              }}
            >
              Add another expense
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPartialSuccessOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                    <span className="flex items-center gap-1">
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
                {expenseDate ? formatRelativeCalendarDate(expenseDate) : "Date"}
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
              placeholder="Dinner"
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
              <SelectTrigger className="h-12 w-16 items-center justify-center shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CURATED_CURRENCIES.map((code) => {
                  const c = getCurrency(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {code}
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
                  ≈ {formatAmount(fxPreview.amountTab, fxPreview.tabCurrency)}{" "}
                  in tab currency
                </p>
              )
            ))}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-0"
            disabled={loading || splitButtonDisabled}
            onClick={() => setSplitDialogOpen(true)}
          >
            <Split
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{splitConfigLabel(splitConfig)}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-0 gap-2"
            disabled={makeRecurringDisabled}
            onClick={handleMakeRecurringClick}
          >
            <CalendarSync
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />

            <span className="truncate">
              {pendingRecurring ? "Edit recurring" : "Make recurring"}
            </span>
          </Button>
        </div>
        <Button type="submit" disabled={loading} className="w-full gap-2">
          {loading ? "Adding..." : "Add expense"}
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

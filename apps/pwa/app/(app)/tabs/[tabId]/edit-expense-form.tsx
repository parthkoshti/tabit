import { useState, useMemo, useRef, useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@/lib/api-client";
import {
  buildExpenseUpdateBody,
  isExpenseFormSubmitDisabled,
  parseExpenseAmount,
  resolveExpensePayerParticipantId,
  validateExpenseFormValues,
} from "@/lib/expense-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/navigation";
import { useExpenseFxPreview } from "@/lib/use-expense-fx-preview";
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
  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(() =>
    inferSplitConfig(expense),
  );
  const splitConfigRef = useRef(splitConfig);
  splitConfigRef.current = splitConfig;
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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

  const initialValues = useMemo(
    () => ({
      amount: (expense.originalAmount ?? expense.amount).toFixed(2),
      currency: expense.currency ?? tabCurrency,
      description: expense.description,
      expenseDate: new Date(expense.expenseDate),
      paidByParticipantId: resolveExpensePayerParticipantId(
        expense,
        tabParticipants,
      ),
      participantIds: expense.splits
        .map((s) => splitRowKey(s))
        .filter((id) => id.length > 0),
    }),
    [expense, tabParticipants, tabCurrency],
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: ({ value }) =>
        validateExpenseFormValues(
          tabId,
          value,
          value.paidByParticipantId,
          splitConfigRef.current,
          tabParticipants,
        ),
    },
    onSubmit: async ({ value }) => {
      const updateBody = buildExpenseUpdateBody(
        value,
        value.paidByParticipantId,
        splitConfigRef.current,
      );

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
        return;
      }

      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to update expense",
          fields: {},
        },
      });
    },
  });

  const amount = useStore(form.store, (s) => s.values.amount);
  const currency = useStore(form.store, (s) => s.values.currency);
  const description = useStore(form.store, (s) => s.values.description);
  const expenseDate = useStore(form.store, (s) => s.values.expenseDate);
  const expenseDateMs = useStore(
    form.store,
    (s) => s.values.expenseDate.getTime(),
  );
  const participantIds = useStore(form.store, (s) => s.values.participantIds);
  const paidByParticipantId = useStore(
    form.store,
    (s) => s.values.paidByParticipantId,
  );
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const participantIdSet = useMemo(
    () => new Set(participantIds),
    [participantIds],
  );
  const busy = isSubmitting || deleting;

  const {
    fxPreview,
    fxPreviewLoading,
    parsedAmount: parsedAmountForSplit,
    tabTotalForSplit,
    splitButtonDisabled,
  } = useExpenseFxPreview({
    tabId,
    tabCurrency,
    amount,
    currency,
    expenseDateMs,
  });

  useEffect(() => {
    if (tabParticipants.length === 0) return;
    setSplitConfig(inferSplitConfig(expense));
    form.reset(initialValues);
  }, [expense, tabParticipants, initialValues, form]);

  useEffect(() => {
    const input = descriptionRef.current;
    if (input) {
      const id = setTimeout(() => input.focus(), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const selectedParticipants = useMemo(
    () => tabParticipants.filter((p) => participantIdSet.has(p.id)),
    [tabParticipants, participantIdSet],
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

  const expenseFormValues = useMemo(
    () => ({
      amount,
      currency,
      description,
      expenseDate,
      participantIds,
    }),
    [amount, currency, description, expenseDate, participantIds],
  );

  const submitDisabled = useMemo(
    () =>
      isExpenseFormSubmitDisabled(
        tabId,
        expenseFormValues,
        paidByParticipantId,
        splitConfig,
        tabParticipants,
        { isSubmitting, splitButtonDisabled },
      ),
    [
      tabId,
      expenseFormValues,
      paidByParticipantId,
      splitConfig,
      tabParticipants,
      isSubmitting,
      splitButtonDisabled,
    ],
  );

  function toggleParticipant(participantId: string) {
    setSplitConfig(null);
    const current = form.state.values.participantIds;
    if (current.includes(participantId)) {
      if (current.length <= 1) {
        form.setErrorMap({
          onSubmit: {
            form: "At least one person must be in the split",
            fields: {},
          },
        });
        return;
      }
      form.setFieldValue(
        "participantIds",
        current.filter((id) => id !== participantId),
      );
    } else {
      form.setFieldValue("participantIds", [...current, participantId]);
    }
  }

  async function handleDelete() {
    setDeleteOpen(false);
    setDeleting(true);
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
      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to delete expense",
          fields: {},
        },
      });
    }
    setDeleting(false);
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div className="flex gap-2">
          <form.Field name="paidByParticipantId">
            {(field) => (
              <div className="min-w-0 flex-1 space-y-1">
                <Select
                  value={field.state.value || undefined}
                  onValueChange={field.handleChange}
                  disabled={busy}
                >
                  <SelectTrigger className="w-full min-w-0 [&>span]:line-clamp-none">
                    <SelectValue placeholder="Select who paid">
                      {(() => {
                        const payer = tabParticipants.find(
                          (p) => p.id === field.state.value,
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
                {field.state.meta.errors[0] ? (
                  <p className="text-sm text-destructive">
                    {String(field.state.meta.errors[0])}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field name="expenseDate">
            {(field) => (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={busy}
                    className={cn(
                      "h-9 shrink-0 gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
                      !field.state.value && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {field.state.value
                      ? formatAbsoluteDate(field.state.value)
                      : "Date"}
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
                    selected={field.state.value}
                    className="w-full"
                    onSelect={(date) => {
                      if (date) {
                        field.handleChange(date);
                        setDatePickerOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </form.Field>
        </div>
        <div className="space-y-2">
          <Label>Split with</Label>
          <div className="grid grid-cols-2 gap-2">
            {tabParticipants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleParticipant(p.id)}
                disabled={busy}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  participantIdSet.has(p.id)
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
            disabled={busy || splitButtonDisabled || hasPlaceholderInSplit}
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
        <form.Field name="description">
          {(field) => (
            <div className="space-y-2">
              <div className="flex h-12 items-center rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
                <span className="pl-3 text-base text-muted-foreground">For</span>
                <Input
                  ref={descriptionRef}
                  id="description"
                  type="text"
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="eg. Dinner"
                  required
                  disabled={busy}
                  className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
              </div>
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive">
                  {String(field.state.meta.errors[0])}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
        <form.Field name="amount">
          {(field) => (
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
                    value={field.state.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
                        field.handleChange(v);
                      }
                    }}
                    onBlur={() => {
                      const num = parseFloat(field.state.value);
                      if (!isNaN(num) && num > 0) {
                        field.handleChange(num.toFixed(2));
                      }
                      field.handleBlur();
                    }}
                    placeholder="0.00"
                    required
                    disabled={busy}
                    className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <form.Field name="currency">
                  {(currencyField) => (
                    <Select
                      value={currencyField.state.value}
                      onValueChange={currencyField.handleChange}
                      disabled={busy}
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
                  )}
                </form.Field>
              </div>
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive">
                  {String(field.state.meta.errors[0])}
                </p>
              ) : null}
              {currency !== tabCurrency &&
                parseExpenseAmount(field.state.value) != null &&
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
          )}
        </form.Field>
        {form.state.errorMap.onSubmit?.form ? (
          <Alert variant="destructive">
            <AlertDescription>
              {String(form.state.errorMap.onSubmit.form)}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(formIsSubmitting) => (
              <Button
                type="submit"
                disabled={submitDisabled || deleting}
                className="w-full gap-2"
              >
                {formIsSubmitting ? "Saving..." : "Save"}
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            )}
          </form.Subscribe>
          <div className="flex flex-col gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
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
              disabled={busy}
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
                void handleDelete();
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

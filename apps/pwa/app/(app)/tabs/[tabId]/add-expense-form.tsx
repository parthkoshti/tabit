"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@/lib/api-client";
import {
  buildExpenseCreateBody,
  parseExpenseAmount,
  validateExpenseFormValues,
} from "@/lib/expense-form";
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
  Check,
  CornerDownLeft,
  Search,
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
  DialogDescription,
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

type TabParticipant = {
  id: string;
  kind: string;
  userId: string | null;
  displayName: string;
  user: Member["user"] | null;
};

function participantLabel(p: TabParticipant, currentUserId: string): string {
  const base = p.user
    ? getDisplayName(p.user, currentUserId)
    : p.displayName;
  return p.kind === "placeholder" ? `${base} (placeholder)` : base;
}

function participantAvatarSeed(p: TabParticipant): string {
  return p.userId ?? p.id;
}

function CurrencyPickerDialog({
  value,
  onValueChange,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedCurrency = getCurrency(value);
  const normalizedQuery = query.trim().toLowerCase();
  const currencies = useMemo(
    () =>
      CURATED_CURRENCIES.filter((code) => {
        if (!normalizedQuery) return true;
        const currency = getCurrency(code);
        return [code, currency?.name, currency?.symbol]
          .filter(Boolean)
          .some((part) => part!.toLowerCase().includes(normalizedQuery));
      }),
    [normalizedQuery],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="h-12 w-16 shrink-0 border-input bg-input-bg px-2 text-base font-semibold shadow-sm hover:bg-input-bg"
        aria-label={`Currency, currently ${value}`}
      >
        {value}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,34rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="text-xl">Select currency</DialogTitle>
            <DialogDescription>
              Search by currency code, name, or symbol.
            </DialogDescription>
          </DialogHeader>
          <div className="border-b border-border bg-background px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search currencies"
                aria-label="Search currencies"
                className="h-11 pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {currencies.length > 0 ? (
              <div className="space-y-1">
                {currencies.map((code) => {
                  const currency = getCurrency(code);
                  const selected = code === value;

                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        onValueChange(code);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        selected &&
                          "bg-primary/10 text-foreground ring-1 ring-primary/25",
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {currency?.symbol ?? code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-medium">
                          <span>{code}</span>
                          <span className="min-w-0 truncate text-muted-foreground">
                            {currency?.name ?? code}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {currency?.name_plural ?? currency?.name ?? code}
                        </span>
                      </span>
                      {selected ? (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                          <span className="sr-only">Selected</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No currencies found.
              </p>
            )}
          </div>
          <div className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
            Current:{" "}
            <span className="font-medium text-foreground">
              {value}
              {selectedCurrency?.name ? ` - ${selectedCurrency.name}` : ""}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Ledger row for the signed-in user, if they belong to this tab. */
function resolveMyParticipantId(
  tabParticipants: TabParticipant[],
  members: Member[],
  currentUserId: string,
): string | null {
  if (!currentUserId || tabParticipants.length === 0) return null;
  const uid = String(currentUserId);
  const direct = tabParticipants.find(
    (p) =>
      (p.userId != null && String(p.userId) === uid) ||
      (p.user != null && String(p.user.id) === uid),
  );
  if (direct) return direct.id;
  const mem = members.find((m) => String(m.userId) === uid);
  if (!mem) return null;
  return (
    tabParticipants.find(
      (p) =>
        p.kind === "member" &&
        ((p.userId != null && String(p.userId) === String(mem.userId)) ||
          (p.user != null && String(p.user.id) === String(mem.user.id))),
    )?.id ?? null
  );
}

export function AddExpenseForm({
  tabId,
  tabCurrency,
  members,
  participants,
  currentUserId,
  onSuccess,
  onExpenseCreated,
}: {
  tabId: string;
  tabCurrency: string;
  members: Member[];
  participants: TabParticipant[];
  currentUserId: string;
  onSuccess?: () => void;
  /** Called once the expense is saved (before the success dialog). Use to refresh lists outside this tab. */
  onExpenseCreated?: () => void;
}) {
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

  const derivedDefaultPayerParticipantId = useMemo((): string => {
    if (tabParticipants.length === 0) return "";
    const mine = resolveMyParticipantId(
      tabParticipants,
      members,
      currentUserId,
    );
    if (mine) return mine;
    if (!currentUserId) return "";
    return tabParticipants[0]!.id;
  }, [tabParticipants, members, currentUserId]);

  const [payerOverrideParticipantId, setPayerOverrideParticipantId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setPayerOverrideParticipantId(null);
  }, [tabId, derivedDefaultPayerParticipantId]);

  const effectivePayerParticipantId =
    payerOverrideParticipantId ?? derivedDefaultPayerParticipantId;

  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(null);
  const splitConfigRef = useRef(splitConfig);
  splitConfigRef.current = splitConfig;
  const effectivePayerRef = useRef(effectivePayerParticipantId);
  effectivePayerRef.current = effectivePayerParticipantId;

  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [recurringSetupOpen, setRecurringSetupOpen] = useState(false);
  const [recurringTemplate, setRecurringTemplate] =
    useState<RecurringTemplatePayload | null>(null);
  const [pendingRecurring, setPendingRecurring] =
    useState<PendingRecurringRuleWithoutTemplate | null>(null);

  const form = useForm({
    defaultValues: {
      amount: "",
      currency: tabCurrency,
      description: "",
      expenseDate: new Date(),
      participantIds: [] as string[],
    },
    validators: {
      onSubmit: ({ value }) =>
        validateExpenseFormValues(
          tabId,
          value,
          effectivePayerRef.current,
          splitConfigRef.current,
          tabParticipants,
        ),
    },
    onSubmit: async ({ value }) => {
      const parsed = parseExpenseAmount(value.amount);
      if (
        parsed !== null &&
        value.currency !== tabCurrency &&
        (fxPreviewLoading || fxPreview?.amountTab == null)
      ) {
        form.setErrorMap({
          onSubmit: {
            form: fxPreviewLoading
              ? "Wait for the exchange rate preview to finish"
              : "Enter a valid amount or wait for tab-currency conversion",
            fields: {},
          },
        });
        return;
      }

      const createBody = buildExpenseCreateBody(
        value,
        effectivePayerRef.current,
        splitConfigRef.current,
        tabParticipants,
      );

      const payerParticipant = tabParticipants.find(
        (p) => p.id === effectivePayerRef.current,
      );
      const paidByForTemplate =
        payerParticipant?.userId != null
          ? payerParticipant.userId
          : currentUserId;
      const prepTemplate =
        splitConfigRef.current == null ||
        splitConfigRef.current.splitType === "equal"
          ? {
              amount: createBody.amount,
              currency: createBody.currency,
              description: createBody.description,
              paidById: paidByForTemplate,
              splitType: "equal" as const,
              participantIds: createBody.participantIds,
            }
          : splitConfigRef.current.splitType === "custom"
            ? {
                amount: createBody.amount,
                currency: createBody.currency,
                description: createBody.description,
                paidById: paidByForTemplate,
                splitType: "custom" as const,
                participantIds: createBody.participantIds,
                splits: splitConfigRef.current.splits,
              }
            : {
                amount: createBody.amount,
                currency: createBody.currency,
                description: createBody.description,
                paidById: paidByForTemplate,
                splitType: splitConfigRef.current.splitType,
                participantIds: createBody.participantIds,
                splits: splitConfigRef.current.splits.map((s) => ({
                  userId: s.userId,
                  weight: s.weight,
                })),
              };

      const createRecurringRule = pendingRecurring
        ? { ...pendingRecurring, template: prepTemplate }
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
        form.reset();
        form.setFieldValue("currency", tabCurrency);
        form.setFieldValue("expenseDate", new Date());
        if (tabParticipants.length > 0) {
          form.setFieldValue(
            "participantIds",
            tabParticipants.map((p) => p.id),
          );
        }
        setSplitConfig(null);
        setPendingRecurring(null);
        queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
        queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
        queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
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
        return;
      }

      if (result.success) {
        form.reset();
        form.setFieldValue("currency", tabCurrency);
        form.setFieldValue("expenseDate", new Date());
        if (tabParticipants.length > 0) {
          form.setFieldValue(
            "participantIds",
            tabParticipants.map((p) => p.id),
          );
        }
        setSplitConfig(null);
        setPendingRecurring(null);
        queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
        queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
        queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        void queryClient.invalidateQueries({
          queryKey: ["recurring-expenses", tabId],
        });
        onExpenseCreated?.();
        setPartialSuccessOpen(true);
        return;
      }

      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to add expense",
          fields: {},
        },
      });
    },
  });

  const amount = useStore(form.store, (s) => s.values.amount);
  const currency = useStore(form.store, (s) => s.values.currency);
  const expenseDate = useStore(form.store, (s) => s.values.expenseDate);
  const participantIds = useStore(form.store, (s) => s.values.participantIds);
  const participantIdSet = useMemo(
    () => new Set(participantIds),
    [participantIds],
  );

  useEffect(() => {
    if (tabParticipants.length === 0) return;
    form.setFieldValue(
      "participantIds",
      tabParticipants.map((p) => p.id),
    );
  }, [tabParticipants, form]);

  useEffect(() => {
    form.setFieldValue("currency", tabCurrency);
  }, [tabCurrency, form]);

  useEffect(() => {
    const input = descriptionRef.current;
    if (input) {
      const id = setTimeout(() => input.focus(), 0);
      return () => clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    const parsed = parseExpenseAmount(amount);
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

  const parsedAmountForSplit = useMemo(
    () => parseExpenseAmount(amount),
    [amount],
  );

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
    const value = form.state.values;
    const fieldErrors = validateExpenseFormValues(
      tabId,
      value,
      effectivePayerParticipantId,
      splitConfig,
      tabParticipants,
    );
    if (fieldErrors) {
      const firstError = Object.values(fieldErrors)[0];
      return { ok: false, error: firstError ?? "Invalid expense" };
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
    const parsedAmount = parseExpenseAmount(value.amount)!;
    const participantIdsList = value.participantIds;
    const payerParticipant = tabParticipants.find(
      (p) => p.id === effectivePayerParticipantId,
    );
    const paidByForTemplate =
      payerParticipant?.userId != null
        ? payerParticipant.userId
        : currentUserId;
    const template: RecurringTemplatePayload =
      splitConfig == null || splitConfig.splitType === "equal"
        ? {
            amount: parsedAmount,
            currency: value.currency,
            description: value.description.trim(),
            paidById: paidByForTemplate,
            splitType: "equal",
            participantIds: participantIdsList,
          }
        : splitConfig.splitType === "custom"
          ? {
              amount: parsedAmount,
              currency: value.currency,
              description: value.description.trim(),
              paidById: paidByForTemplate,
              splitType: "custom",
              participantIds: participantIdsList,
              splits: splitConfig.splits,
            }
          : {
              amount: parsedAmount,
              currency: value.currency,
              description: value.description.trim(),
              paidById: paidByForTemplate,
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
      form.state.isSubmitting ||
      parseExpenseAmount(amount) === null ||
      !form.state.values.description.trim() ||
      selectedParticipants.length < 1 ||
      (selectedParticipants.length === 1 &&
        selectedParticipants[0]!.id === effectivePayerParticipantId) ||
      splitButtonDisabled,
    [
      form.state.isSubmitting,
      form.state.values.description,
      amount,
      selectedParticipants,
      effectivePayerParticipantId,
      splitButtonDisabled,
    ],
  );

  function handleMakeRecurringClick() {
    const payerParticipant = tabParticipants.find(
      (p) => p.id === effectivePayerParticipantId,
    );
    if (!payerParticipant?.userId) {
      form.setErrorMap({
        onSubmit: {
          form: "Recurring expenses need a registered member as payer",
          fields: {},
        },
      });
      return;
    }
    const prep = prepareRecurringTemplate();
    if (!prep.ok) {
      form.setErrorMap({
        onSubmit: { form: prep.error, fields: {} },
      });
      return;
    }
    setRecurringTemplate(prep.template);
    setRecurringSetupOpen(true);
  }

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div className="flex gap-2">
          <Select
            value={effectivePayerParticipantId || undefined}
            onValueChange={setPayerOverrideParticipantId}
            disabled={form.state.isSubmitting}
          >
            <SelectTrigger className="flex-1 min-w-0 [&>span]:line-clamp-none">
              <SelectValue placeholder="Select who paid">
                {(() => {
                  const payer = tabParticipants.find(
                    (p) => p.id === effectivePayerParticipantId,
                  );
                  return payer ? (
                    <span className="flex items-center gap-1">
                      <UserAvatar userId={participantAvatarSeed(payer)} size="xs" />
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
                    <UserAvatar userId={participantAvatarSeed(p)} size="xs" />
                    {participantLabel(p, currentUserId)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form.Field name="expenseDate">
            {(field) => (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={form.state.isSubmitting}
                    className={cn(
                      "h-9 shrink-0 gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
                      !field.state.value && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {field.state.value
                      ? formatRelativeCalendarDate(field.state.value)
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
                disabled={form.state.isSubmitting}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  participantIdSet.has(p.id)
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <UserAvatar userId={participantAvatarSeed(p)} size="xs" />
                <span className="min-w-0 truncate">
                  {participantLabel(p, currentUserId)}
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
                  placeholder="Dinner"
                  required
                  disabled={form.state.isSubmitting}
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
                    disabled={form.state.isSubmitting}
                    className="h-12 flex-1 border-0 bg-transparent pl-1 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <form.Field name="currency">
                  {(currencyField) => (
                    <CurrencyPickerDialog
                      value={currencyField.state.value}
                      onValueChange={currencyField.handleChange}
                      disabled={form.state.isSubmitting}
                    />
                  )}
                </form.Field>
              </div>
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive">
                  {String(field.state.meta.errors[0])}
                </p>
              ) : null}
              <div className="h-4" aria-live="polite">
                {currency !== tabCurrency &&
                parseExpenseAmount(field.state.value) != null ? (
                  fxPreviewLoading ? (
                    <Skeleton className="h-4 w-[min(100%,12rem)]" />
                  ) : fxPreview ? (
                    <p className="text-xs text-muted-foreground">
                      ≈{" "}
                      {formatAmount(fxPreview.amountTab, fxPreview.tabCurrency)}{" "}
                      in tab currency
                    </p>
                  ) : null
                ) : null}
              </div>
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
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-0"
            disabled={
              form.state.isSubmitting ||
              splitButtonDisabled ||
              hasPlaceholderInSplit
            }
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
        <Button
          type="submit"
          disabled={form.state.isSubmitting}
          className="w-full gap-2"
        >
          {form.state.isSubmitting ? "Adding..." : "Add expense"}
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

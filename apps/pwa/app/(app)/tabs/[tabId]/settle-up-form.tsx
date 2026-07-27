"use client";

import { useState, useEffect } from "react";
import { useExpenseFxPreview } from "@/lib/use-expense-fx-preview";
import { useForm, useStore } from "@tanstack/react-form";
import { recordSettlementSchema } from "models";
import { api } from "@/lib/api-client";
import { zodFieldErrors } from "@/lib/form-zod";
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
import { Calendar as CalendarIcon } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { formatAmount } from "@/lib/format-amount";
import { formatAbsoluteDate } from "@/lib/format-date";
import { CURATED_CURRENCIES, getCurrency, simplifyDebts } from "shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Balance } from "@/lib/domain-types";

type TabParticipant = {
  id: string;
  kind: string;
  userId: string | null;
  displayName: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  } | null;
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

function parseAmount(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0.01) return null;
  return num;
}

function formatSettlementAmount(amount: number, currency: string): string {
  const digits = (getCurrency(currency) ?? getCurrency("USD"))!.decimal_digits;
  return amount.toFixed(digits);
}

function transferKey(fromParticipantId: string, toParticipantId: string) {
  return `${fromParticipantId}->${toParticipantId}`;
}

/** Pairwise amounts from simplified balances: who should pay whom. */
function buildSuggestedTransfers(
  balances: Balance[],
  currency: string,
): Map<string, number> {
  const { transfers } = simplifyDebts(
    balances.map((b) => ({
      participantId: b.participantId,
      amount: b.amount,
    })),
    { currency },
  );
  return new Map(
    transfers.map((t) => [
      transferKey(t.fromParticipantId, t.toParticipantId),
      t.amount,
    ]),
  );
}

function suggestedSettlementForPayer(
  fromParticipantId: string,
  transfers: Map<string, number>,
): { toParticipantId: string; amount: number } | null {
  let best: { toParticipantId: string; amount: number } | null = null;
  for (const [key, amount] of transfers) {
    const sep = key.indexOf("->");
    if (sep < 0) continue;
    if (key.slice(0, sep) !== fromParticipantId) continue;
    const toParticipantId = key.slice(sep + 2);
    if (!best || amount > best.amount) {
      best = { toParticipantId, amount };
    }
  }
  return best;
}

function defaultSettleUpValues(
  currentUserId: string,
  participants: TabParticipant[],
  balances: Balance[],
  tabCurrency: string,
) {
  const myParticipantId =
    participants.find((p) => p.userId === currentUserId)?.id ??
    balances.find((b) => b.userId === currentUserId)?.participantId ??
    "";

  if (!myParticipantId) {
    return {
      fromParticipantId: "",
      toParticipantId: "",
      amount: "",
    };
  }

  const transfers = buildSuggestedTransfers(balances, tabCurrency);
  const suggested = suggestedSettlementForPayer(myParticipantId, transfers);

  return {
    fromParticipantId: myParticipantId,
    toParticipantId: suggested?.toParticipantId ?? "",
    amount: suggested
      ? formatSettlementAmount(suggested.amount, tabCurrency)
      : "",
  };
}

export function SettleUpForm({
  tabId,
  currentUserId,
  participants,
  balances,
  tabCurrency = "USD",
  onSuccess,
}: {
  tabId: string;
  currentUserId: string;
  participants: TabParticipant[];
  balances: Balance[];
  tabCurrency?: string;
  onSuccess?: () => void;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const queryClient = useQueryClient();

  const suggestedTransfers = buildSuggestedTransfers(balances, tabCurrency);
  const defaults = defaultSettleUpValues(
    currentUserId,
    participants,
    balances,
    tabCurrency,
  );

  const form = useForm({
    defaultValues: {
      fromParticipantId: defaults.fromParticipantId,
      toParticipantId: defaults.toParticipantId,
      settlementDate: new Date(),
      amount: defaults.amount,
      currency: tabCurrency,
    },
    validators: {
      onSubmit: ({ value }) => {
        const fromP = participants.find((p) => p.id === value.fromParticipantId);
        const toP = participants.find((p) => p.id === value.toParticipantId);
        const parsed = parseAmount(value.amount);
        if (!fromP || !toP) {
          const errors: Record<string, string> = {};
          if (!fromP) errors.fromParticipantId = "Please select who paid";
          if (!toP) errors.toParticipantId = "Please select who received";
          return errors;
        }
        return zodFieldErrors(recordSettlementSchema, {
          tabId,
          fromParticipantId: value.fromParticipantId,
          toParticipantId: value.toParticipantId,
          fromUserId: fromP.userId,
          toUserId: toP.userId,
          amount: parsed ?? NaN,
          settlementDate: value.settlementDate,
          ...(value.currency !== tabCurrency ? { currency: value.currency } : {}),
        });
      },
    },
    onSubmit: async ({ value }) => {
      const fromP = participants.find((p) => p.id === value.fromParticipantId);
      const toP = participants.find((p) => p.id === value.toParticipantId);
      if (!fromP || !toP) return;

      const parsed = parseAmount(value.amount);
      if (parsed === null) return;

      const result = await api.settlements.record(tabId, {
        fromUserId: fromP.userId,
        toUserId: toP.userId,
        fromParticipantId: fromP.id,
        toParticipantId: toP.id,
        amount: parsed,
        settlementDate: value.settlementDate.toISOString(),
        ...(value.currency !== tabCurrency ? { currency: value.currency } : {}),
      });

      if (result.success) {
        form.reset();
        form.setFieldValue("currency", tabCurrency);
        form.setFieldValue("settlementDate", new Date());
        queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
        queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
        queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
        queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        toast.success("Settlement recorded");
        onSuccess?.();
        return;
      }

      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to record settlement",
          fields: {},
        },
      });
    },
  });

  const amount = useStore(form.store, (s) => s.values.amount);
  const currency = useStore(form.store, (s) => s.values.currency);
  const settlementDateMs = useStore(
    form.store,
    (s) => s.values.settlementDate.getTime(),
  );

  const { fxPreview, fxPreviewLoading } = useExpenseFxPreview({
    tabId,
    tabCurrency,
    amount,
    currency,
    expenseDateMs: settlementDateMs,
  });

  useEffect(() => {
    form.setFieldValue("currency", tabCurrency);
  }, [tabCurrency, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="fromParticipantId">
        {(field) => (
          <div className="space-y-2">
            <Label>Paid by</Label>
            <Select
              value={field.state.value || undefined}
              onValueChange={(value) => {
                field.handleChange(value);
                const suggested = suggestedSettlementForPayer(
                  value,
                  suggestedTransfers,
                );
                form.setFieldValue(
                  "toParticipantId",
                  suggested?.toParticipantId ?? "",
                );
                form.setFieldValue(
                  "amount",
                  suggested
                    ? formatSettlementAmount(suggested.amount, tabCurrency)
                    : "",
                );
                form.setFieldValue("currency", tabCurrency);
              }}
              disabled={form.state.isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select who paid" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={participantAvatarSeed(p)} size="sm" />
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
      <form.Field name="toParticipantId">
        {(field) => (
          <div className="space-y-2">
            <Label>Paid to</Label>
            <Select
              value={field.state.value || undefined}
              onValueChange={(value) => {
                field.handleChange(value);
                const fromId = form.state.values.fromParticipantId;
                const owed = fromId
                  ? suggestedTransfers.get(transferKey(fromId, value))
                  : undefined;
                if (owed != null && owed > 0) {
                  form.setFieldValue(
                    "amount",
                    formatSettlementAmount(owed, tabCurrency),
                  );
                  form.setFieldValue("currency", tabCurrency);
                } else {
                  form.setFieldValue("amount", "");
                }
              }}
              disabled={
                form.state.isSubmitting ||
                !form.state.values.fromParticipantId
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select who received" />
              </SelectTrigger>
              <SelectContent>
                {participants
                  .filter(
                    (p) => p.id !== form.state.values.fromParticipantId,
                  )
                  .map((p) => {
                    const fromId = form.state.values.fromParticipantId;
                    const owed = fromId
                      ? suggestedTransfers.get(transferKey(fromId, p.id))
                      : undefined;
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            userId={participantAvatarSeed(p)}
                            size="sm"
                          />
                          {participantLabel(p, currentUserId)}
                          {owed != null && owed > 0 && (
                            <>
                              {" "}
                              (owed {formatAmount(owed, tabCurrency)})
                            </>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
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
      <form.Field name="settlementDate">
        {(field) => (
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.state.isSubmitting}
                  className={cn(
                    "h-9 w-full justify-start gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
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
                align="start"
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
                  {getCurrency(form.state.values.currency)?.symbol ??
                    form.state.values.currency}
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
                  <Select
                    value={currencyField.state.value}
                    onValueChange={currencyField.handleChange}
                    disabled={form.state.isSubmitting}
                  >
                    <SelectTrigger className="h-12 w-16 shrink-0 items-center justify-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {CURATED_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
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
            {form.state.values.currency !== tabCurrency &&
              parseAmount(field.state.value) != null &&
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
      <Button type="submit" disabled={form.state.isSubmitting} variant="secondary">
        {form.state.isSubmitting ? "Recording..." : "Record settlement"}
      </Button>
    </form>
  );
}

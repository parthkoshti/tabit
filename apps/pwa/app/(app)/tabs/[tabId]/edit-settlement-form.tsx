import { useState, useEffect, useMemo } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { updateSettlementSchema } from "models";
import { api } from "@/lib/api-client";
import { zodFieldErrors } from "@/lib/form-zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/navigation";
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
import { Calendar as CalendarIcon, CornerDownLeft, Trash2 } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { formatAmount } from "@/lib/format-amount";
import { formatAbsoluteDate } from "@/lib/format-date";
import { CURATED_CURRENCIES, getCurrency } from "shared";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar,
  CALENDAR_POPOVER_CONTENT_CLASSNAME,
} from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Settlement } from "@/lib/domain-types";

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

function toDate(d: Date | string | undefined, fallback: Date | string): Date {
  const raw = d ?? fallback;
  return typeof raw === "string" ? new Date(raw) : raw;
}

function parseAmount(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0.01) return null;
  return num;
}

function displayAmountForSettlement(
  settlement: Settlement,
  tabCurrency: string,
): string {
  const foreign =
    settlement.currency &&
    settlement.currency !== tabCurrency &&
    settlement.originalAmount != null;
  const displayAmount =
    foreign && settlement.originalAmount != null
      ? settlement.originalAmount
      : settlement.amount;
  return displayAmount.toFixed(2);
}

export function EditSettlementForm({
  settlementId,
  tabId,
  tabCurrency,
  settlement,
  members,
  participants,
  currentUserId,
  onSuccess,
  onDeleteSuccess,
  onCancel,
}: {
  settlementId: string;
  tabId: string;
  tabCurrency: string;
  settlement: Settlement;
  members: Member[];
  participants: TabParticipant[];
  currentUserId: string;
  onSuccess?: () => void;
  onDeleteSuccess?: () => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const [fxPreview, setFxPreview] = useState<{
    amountTab: number;
    tabCurrency: string;
  } | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

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

  const initialFrom =
    settlement.fromParticipantId ??
    tabParticipants.find((p) => p.userId === settlement.fromUserId)?.id ??
    "";
  const initialTo =
    settlement.toParticipantId ??
    tabParticipants.find((p) => p.userId === settlement.toUserId)?.id ??
    "";

  const form = useForm({
    defaultValues: {
      fromParticipantId: initialFrom,
      toParticipantId: initialTo,
      settlementDate: toDate(settlement.settlementDate, settlement.createdAt),
      currency: settlement.currency ?? tabCurrency,
      amount: displayAmountForSettlement(settlement, tabCurrency),
    },
    validators: {
      onSubmit: ({ value }) => {
        if (value.fromParticipantId === value.toParticipantId) {
          return { toParticipantId: "Payer and payee must be different people" };
        }
        const fromP = tabParticipants.find(
          (p) => p.id === value.fromParticipantId,
        );
        const toP = tabParticipants.find((p) => p.id === value.toParticipantId);
        if (!fromP || !toP) {
          const errors: Record<string, string> = {};
          if (!fromP) errors.fromParticipantId = "Please select who paid";
          if (!toP) errors.toParticipantId = "Please select who received";
          return errors;
        }
        const parsed = parseAmount(value.amount);
        return zodFieldErrors(updateSettlementSchema, {
          fromParticipantId: value.fromParticipantId,
          toParticipantId: value.toParticipantId,
          fromUserId: fromP.userId,
          toUserId: toP.userId,
          amount: parsed ?? NaN,
          settlementDate: value.settlementDate,
          ...(value.currency !== tabCurrency
            ? { currency: value.currency, originalAmount: parsed ?? undefined }
            : {}),
        });
      },
    },
    onSubmit: async ({ value }) => {
      const fromP = tabParticipants.find(
        (p) => p.id === value.fromParticipantId,
      );
      const toP = tabParticipants.find((p) => p.id === value.toParticipantId);
      if (!fromP || !toP) return;

      const parsedAmount = parseAmount(value.amount);
      if (parsedAmount === null) return;

      const result = await api.settlements.update(tabId, settlementId, {
        fromUserId: fromP.userId,
        toUserId: toP.userId,
        fromParticipantId: value.fromParticipantId,
        toParticipantId: value.toParticipantId,
        amount: parsedAmount,
        settlementDate: value.settlementDate.toISOString(),
        ...(value.currency !== tabCurrency
          ? { currency: value.currency, originalAmount: parsedAmount }
          : {}),
      });

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
        queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
        queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
        queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        queryClient.invalidateQueries({
          queryKey: ["settlement", tabId, settlementId],
        });
        queryClient.invalidateQueries({
          queryKey: ["settlementAuditLog", tabId, settlementId],
        });
        toast.success("Settlement updated");
        if (onSuccess) onSuccess();
        else navigate(`/tabs/${tabId}`);
        return;
      }

      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to update settlement",
          fields: {},
        },
      });
    },
  });

  const amount = useStore(form.store, (s) => s.values.amount);
  const currency = useStore(form.store, (s) => s.values.currency);
  const settlementDate = useStore(form.store, (s) => s.values.settlementDate);
  const busy = form.state.isSubmitting || deleting;

  useEffect(() => {
    if (tabParticipants.length === 0) return;
    const from =
      settlement.fromParticipantId ??
      tabParticipants.find((p) => p.userId === settlement.fromUserId)?.id ??
      "";
    const to =
      settlement.toParticipantId ??
      tabParticipants.find((p) => p.userId === settlement.toUserId)?.id ??
      "";
    form.setFieldValue("fromParticipantId", from);
    form.setFieldValue("toParticipantId", to);
    form.setFieldValue(
      "settlementDate",
      toDate(settlement.settlementDate, settlement.createdAt),
    );
    form.setFieldValue("currency", settlement.currency ?? tabCurrency);
    form.setFieldValue(
      "amount",
      displayAmountForSettlement(settlement, tabCurrency),
    );
  }, [settlement, tabCurrency, tabParticipants, form]);

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
          expenseDate: settlementDate.toISOString(),
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
  }, [amount, currency, tabId, tabCurrency, settlementDate]);

  async function handleDelete() {
    setDeleteOpen(false);
    setDeleting(true);
    const result = await api.settlements.delete(tabId, settlementId);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Settlement deleted");
      const cb = onDeleteSuccess ?? onSuccess;
      if (cb) cb();
      else navigate(`/tabs/${tabId}`);
    } else {
      form.setErrorMap({
        onSubmit: {
          form: result.error ?? "Failed to delete settlement",
          fields: {},
        },
      });
    }
    setDeleting(false);
  }

  const otherParticipants = tabParticipants.filter(
    (p) => p.id !== form.state.values.fromParticipantId,
  );

  return (
    <>
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
                onValueChange={(v) => {
                  field.handleChange(v);
                  if (form.state.values.toParticipantId === v) {
                    form.setFieldValue("toParticipantId", "");
                  }
                }}
                disabled={busy}
              >
                <SelectTrigger className="[&>span]:line-clamp-none">
                  <SelectValue placeholder="Select who paid">
                    {(() => {
                      const payer = tabParticipants.find(
                        (p) => p.id === field.state.value,
                      );
                      return payer ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            userId={participantAvatarSeed(payer)}
                            size="xs"
                          />
                          {participantLabel(payer, currentUserId)}
                        </span>
                      ) : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tabParticipants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          userId={participantAvatarSeed(p)}
                          size="xs"
                        />
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
                onValueChange={field.handleChange}
                disabled={busy || !form.state.values.fromParticipantId}
              >
                <SelectTrigger className="[&>span]:line-clamp-none">
                  <SelectValue placeholder="Select who received">
                    {(() => {
                      const payee = tabParticipants.find(
                        (p) => p.id === field.state.value,
                      );
                      return payee ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            userId={participantAvatarSeed(payee)}
                            size="xs"
                          />
                          {participantLabel(payee, currentUserId)}
                        </span>
                      ) : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherParticipants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          userId={participantAvatarSeed(p)}
                          size="xs"
                        />
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
        <form.Field name="settlementDate">
          {(field) => (
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
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
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy} className="w-full gap-2">
            {form.state.isSubmitting ? "Saving..." : "Save"}
            <CornerDownLeft className="h-4 w-4" />
          </Button>
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

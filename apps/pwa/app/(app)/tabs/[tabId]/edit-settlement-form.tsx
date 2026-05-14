import { useState, useEffect, useMemo } from "react";
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
import type { Settlement } from "data";

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

  function toDate(d: Date | string | undefined, fallback: Date | string): Date {
    const raw = d ?? fallback;
    return typeof raw === "string" ? new Date(raw) : raw;
  }

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

  const [fromParticipantId, setFromParticipantId] = useState("");
  const [toParticipantId, setToParticipantId] = useState("");
  const [settlementDate, setSettlementDate] = useState<Date>(() =>
    toDate(settlement.settlementDate, settlement.createdAt),
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [currency, setCurrency] = useState(
    settlement.currency ?? tabCurrency,
  );
  const [amount, setAmount] = useState(() => {
    const foreign =
      settlement.currency &&
      settlement.currency !== tabCurrency &&
      settlement.originalAmount != null;
    const displayAmount =
      foreign && settlement.originalAmount != null
        ? settlement.originalAmount
        : settlement.amount;
    return displayAmount.toFixed(2);
  });
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [fxPreview, setFxPreview] = useState<{
    amountTab: number;
    tabCurrency: string;
  } | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

  function parseAmount(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.01) return null;
    return num;
  }

  useEffect(() => {
    setCurrency(settlement.currency ?? tabCurrency);
    setSettlementDate(toDate(settlement.settlementDate, settlement.createdAt));
    const foreign =
      settlement.currency &&
      settlement.currency !== tabCurrency &&
      settlement.originalAmount != null;
    const displayAmount =
      foreign && settlement.originalAmount != null
        ? settlement.originalAmount
        : settlement.amount;
    setAmount(displayAmount.toFixed(2));
  }, [settlement, tabCurrency]);

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
    setFromParticipantId(from);
    setToParticipantId(to);
  }, [settlement, tabParticipants]);

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

    if (!fromParticipantId || !toParticipantId) {
      setError("Please select both payer and payee");
      setLoading(false);
      return;
    }

    if (fromParticipantId === toParticipantId) {
      setError("Payer and payee must be different people");
      setLoading(false);
      return;
    }

    const fromP = tabParticipants.find((p) => p.id === fromParticipantId);
    const toP = tabParticipants.find((p) => p.id === toParticipantId);
    if (!fromP || !toP) {
      setError("Invalid payer or payee");
      setLoading(false);
      return;
    }

    const result = await api.settlements.update(tabId, settlementId, {
      fromUserId: fromP.userId,
      toUserId: toP.userId,
      fromParticipantId,
      toParticipantId,
      amount: parsedAmount,
      settlementDate: settlementDate.toISOString(),
      ...(currency !== tabCurrency
        ? { currency, originalAmount: parsedAmount }
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
      queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
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

  const otherParticipants = tabParticipants.filter(
    (p) => p.id !== fromParticipantId,
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Paid by</Label>
          <Select
            value={fromParticipantId || undefined}
            onValueChange={(v) => {
              setFromParticipantId(v);
              if (toParticipantId === v) setToParticipantId("");
            }}
            disabled={loading}
          >
            <SelectTrigger className="[&>span]:line-clamp-none">
              <SelectValue placeholder="Select who paid">
                {(() => {
                  const payer = tabParticipants.find(
                    (p) => p.id === fromParticipantId,
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
                    <UserAvatar userId={participantAvatarSeed(p)} size="xs" />
                    {participantLabel(p, currentUserId)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Paid to</Label>
          <Select
            value={toParticipantId || undefined}
            onValueChange={setToParticipantId}
            disabled={loading || !fromParticipantId}
          >
            <SelectTrigger className="[&>span]:line-clamp-none">
              <SelectValue placeholder="Select who received">
                {(() => {
                  const payee = tabParticipants.find(
                    (p) => p.id === toParticipantId,
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
                    <UserAvatar userId={participantAvatarSeed(p)} size="xs" />
                    {participantLabel(p, currentUserId)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className={cn(
                  "h-9 w-full justify-start gap-2 rounded-md border-input bg-input-bg px-3 text-sm font-normal shadow-sm hover:bg-input-bg",
                  !settlementDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {settlementDate ? formatAbsoluteDate(settlementDate) : "Date"}
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
                selected={settlementDate}
                className="w-full"
                onSelect={(date) => {
                  if (date) {
                    setSettlementDate(date);
                    setDatePickerOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
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

"use client";

import { useState, useEffect } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import { formatAmount } from "@/lib/format-amount";
import { formatAbsoluteDate } from "@/lib/format-date";
import { CURATED_CURRENCIES, getCurrency } from "shared";
import { Skeleton } from "@/components/ui/skeleton";
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

type Balance = {
  userId: string;
  amount: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export function SettleUpForm({
  tabId,
  currentUserId,
  members,
  balances,
  tabCurrency = "USD",
  onSuccess,
}: {
  tabId: string;
  currentUserId: string;
  members: Member[];
  balances: Balance[];
  tabCurrency?: string;
  onSuccess?: () => void;
}) {
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [settlementDate, setSettlementDate] = useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(tabCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [fxPreview, setFxPreview] = useState<{
    amountTab: number;
    tabCurrency: string;
  } | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

  const balanceMap = Object.fromEntries(
    balances.map((b) => [b.userId, b.amount]),
  );

  function parseAmount(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.01) return null;
    return num;
  }

  useEffect(() => {
    setCurrency(tabCurrency);
  }, [tabCurrency]);

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
    if (!fromUserId || !toUserId) {
      setError("Please select both payer and payee");
      return;
    }
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError("Please enter a valid amount");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await api.settlements.record(
      tabId,
      fromUserId,
      toUserId,
      parsed,
      {
        settlementDate: settlementDate.toISOString(),
        ...(currency !== tabCurrency ? { currency } : {}),
      },
    );

    if (result.success) {
      setFromUserId("");
      setToUserId("");
      setAmount("");
      setSettlementDate(new Date());
      setCurrency(tabCurrency);
      queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
      queryClient.invalidateQueries({ queryKey: ["settlements", tabId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Settlement recorded");
      onSuccess?.();
    } else {
      setError(result.error ?? "Failed to record settlement");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Paid by</Label>
        <Select
          value={fromUserId || undefined}
          onValueChange={(value) => {
            setFromUserId(value);
            setToUserId("");
            setAmount("");
            setCurrency(tabCurrency);
          }}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select who paid" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                <span className="flex items-center gap-2">
                  <UserAvatar userId={m.userId} size="sm" />
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
          value={toUserId || undefined}
          onValueChange={(value) => {
            setToUserId(value);
            const owed = balanceMap[value] ?? 0;
            if (owed > 0) {
              setAmount(owed.toFixed(2));
              setCurrency(tabCurrency);
            }
          }}
          disabled={loading || !fromUserId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select who received" />
          </SelectTrigger>
          <SelectContent>
            {members
              .filter((m) => m.userId !== fromUserId)
              .map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <span className="flex items-center gap-2">
                    <UserAvatar userId={m.userId} size="sm" />
                    {getDisplayName(m.user, currentUserId)}
                    {(balanceMap[m.userId] ?? 0) > 0 && (
                      <>
                        {" "}
                        (owed{" "}
                        {formatAmount(balanceMap[m.userId] ?? 0, tabCurrency)})
                      </>
                    )}
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
            className="w-auto min-w-72 rounded-lg border-border p-0 shadow-md overflow-clip"
            align="start"
            sideOffset={4}
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
      <Button type="submit" disabled={loading} variant="secondary">
        {loading ? "Recording..." : "Record settlement"}
      </Button>
    </form>
  );
}

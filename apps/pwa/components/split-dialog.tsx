"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { getDisplayName } from "@/lib/display-name";
import { formatAmount } from "@/lib/format-amount";
import { getCurrency } from "shared";
import { cn } from "@/lib/utils";
import { ChartPie } from "lucide-react";

export type SplitParticipant = {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export type SplitConfig =
  | { splitType: "equal" }
  | {
      splitType: "custom";
      splits: { userId: string; amount: number }[];
    }
  | {
      splitType: "percent";
      splits: { userId: string; weight: number }[];
    }
  | {
      splitType: "shares";
      splits: { userId: string; weight: number }[];
    };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Equal whole percentages that sum to 100 (remainder on last). */
function defaultPercents(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [100];
  const per = Math.floor((100 / n) * 100) / 100;
  const out = Array.from({ length: n }, () => per);
  const sumRest = round2(per * (n - 1));
  out[n - 1] = round2(100 - sumRest);
  return out;
}

function expenseToTabAmounts(
  expenseParts: number[],
  expenseTotal: number,
  tabTotal: number,
): number[] {
  if (expenseParts.length === 0) return [];
  if (expenseTotal <= 0) return expenseParts.map(() => 0);
  const ratio = tabTotal / expenseTotal;
  const tabParts: number[] = [];
  for (let i = 0; i < expenseParts.length - 1; i++) {
    tabParts.push(round2(expenseParts[i]! * ratio));
  }
  const allocated = tabParts.reduce((a, b) => a + b, 0);
  tabParts.push(round2(tabTotal - allocated));
  return tabParts;
}

export function splitConfigLabel(config: SplitConfig | null): string {
  if (config == null || config.splitType === "equal")
    return "Splitting equally";
  if (config.splitType === "shares") return "Splitting by shares";
  if (config.splitType === "percent") return "Splitting by %";
  return "Custom split";
}

export function SplitDialog({
  open,
  onOpenChange,
  participants,
  tabTotal,
  expenseTotal,
  expenseCurrency,
  tabCurrency,
  currentUserId,
  initialConfig,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: SplitParticipant[];
  tabTotal: number;
  expenseTotal: number;
  expenseCurrency: string;
  tabCurrency: string;
  currentUserId: string;
  initialConfig: SplitConfig | null;
  onConfirm: (config: SplitConfig) => void;
}) {
  const [tab, setTab] = useState<"equal" | "shares" | "percent" | "custom">(
    "equal",
  );
  const [shareStr, setShareStr] = useState<Record<string, string>>({});
  const [pctStr, setPctStr] = useState<Record<string, string>>({});
  const [customStr, setCustomStr] = useState<Record<string, string>>({});

  const showBothCurrencies = expenseCurrency !== tabCurrency;
  const expSym = getCurrency(expenseCurrency)?.symbol ?? expenseCurrency;
  const tabSym = getCurrency(tabCurrency)?.symbol ?? tabCurrency;

  useEffect(() => {
    if (!open) return;
    const ids = participants.map((p) => p.userId);
    const nextShares: Record<string, string> = {};
    const nextPct: Record<string, string> = {};
    const nextCustom: Record<string, string> = {};

    if (initialConfig == null || initialConfig.splitType === "equal") {
      setTab("equal");
      const perExp =
        participants.length > 0
          ? round2(expenseTotal / participants.length)
          : 0;
      const parts: number[] = [];
      for (let i = 0; i < participants.length - 1; i++) parts.push(perExp);
      if (participants.length > 0) {
        const sumMid = parts.reduce((a, b) => a + b, 0);
        parts.push(round2(expenseTotal - sumMid));
      }
      ids.forEach((id, i) => {
        nextShares[id] = "1";
        nextCustom[id] =
          parts[i] != null ? parts[i]!.toFixed(2) : perExp.toFixed(2);
      });
      const pcts = defaultPercents(participants.length);
      ids.forEach((id, i) => {
        nextPct[id] =
          pcts[i] != null
            ? String(pcts[i])
            : (100 / participants.length).toFixed(2);
      });
    } else if (initialConfig.splitType === "shares") {
      setTab("shares");
      for (const s of initialConfig.splits) {
        nextShares[s.userId] = String(s.weight);
      }
      ids.forEach((id) => {
        if (nextShares[id] === undefined) nextShares[id] = "1";
      });
      const pcts = defaultPercents(participants.length);
      ids.forEach((id, i) => {
        nextPct[id] =
          pcts[i] != null
            ? String(pcts[i])
            : (100 / participants.length).toFixed(2);
      });
      const perExp =
        participants.length > 0
          ? round2(expenseTotal / participants.length)
          : 0;
      ids.forEach((id) => {
        nextCustom[id] = perExp.toFixed(2);
      });
    } else if (initialConfig.splitType === "percent") {
      setTab("percent");
      for (const s of initialConfig.splits) {
        nextPct[s.userId] = String(s.weight);
      }
      ids.forEach((id) => {
        if (nextPct[id] === undefined) {
          nextPct[id] = (100 / Math.max(participants.length, 1)).toFixed(2);
        }
      });
      ids.forEach((id) => {
        nextShares[id] = "1";
      });
      const perExp =
        participants.length > 0
          ? round2(expenseTotal / participants.length)
          : 0;
      ids.forEach((id) => {
        nextCustom[id] = perExp.toFixed(2);
      });
    } else {
      setTab("custom");
      const ratio = expenseTotal > 0 ? tabTotal / expenseTotal : 1;
      for (const s of initialConfig.splits) {
        const expAmt = round2(s.amount / ratio);
        nextCustom[s.userId] = expAmt.toFixed(2);
      }
      ids.forEach((id) => {
        if (nextCustom[id] === undefined) {
          const per =
            participants.length > 0
              ? round2(expenseTotal / participants.length)
              : 0;
          nextCustom[id] = per.toFixed(2);
        }
        nextShares[id] = "1";
      });
      const pcts = defaultPercents(participants.length);
      ids.forEach((id, i) => {
        nextPct[id] =
          pcts[i] != null
            ? String(pcts[i])
            : (100 / participants.length).toFixed(2);
      });
    }

    setShareStr(nextShares);
    setPctStr(nextPct);
    setCustomStr(nextCustom);
  }, [open, initialConfig, participants, expenseTotal, tabTotal]);

  const shareParsed = useMemo(() => {
    const out: Record<string, number> = {};
    let ok = true;
    for (const p of participants) {
      const v = parseInt(shareStr[p.userId] ?? "0", 10);
      if (!Number.isFinite(v) || v < 1) ok = false;
      out[p.userId] = v;
    }
    return { map: out, ok };
  }, [participants, shareStr]);

  const pctParsed = useMemo(() => {
    const out: Record<string, number> = {};
    let ok = true;
    let sum = 0;
    for (const p of participants) {
      const v = parseFloat(pctStr[p.userId] ?? "");
      if (!Number.isFinite(v) || v <= 0) ok = false;
      out[p.userId] = v;
      sum += v;
    }
    if (Math.abs(sum - 100) > 0.01) ok = false;
    return { map: out, sum, ok };
  }, [participants, pctStr]);

  const customParsed = useMemo(() => {
    const out: Record<string, number> = {};
    let ok = true;
    let sum = 0;
    for (const p of participants) {
      const v = parseFloat(customStr[p.userId] ?? "");
      if (!Number.isFinite(v) || v <= 0) ok = false;
      out[p.userId] = v;
      sum += v;
    }
    if (Math.abs(round2(sum) - round2(expenseTotal)) > 0.01) ok = false;
    return { map: out, sum, ok };
  }, [participants, customStr, expenseTotal]);

  const sharePreviewTab = useMemo(() => {
    if (!shareParsed.ok || participants.length === 0) return [];
    const totalSh = participants.reduce(
      (a, p) => a + shareParsed.map[p.userId]!,
      0,
    );
    const amounts: number[] = [];
    for (let i = 0; i < participants.length - 1; i++) {
      const w = shareParsed.map[participants[i]!.userId]!;
      amounts.push(round2((w / totalSh) * tabTotal));
    }
    const allocated = amounts.reduce((a, b) => a + b, 0);
    amounts.push(round2(tabTotal - allocated));
    return amounts;
  }, [shareParsed, participants, tabTotal]);

  const pctPreviewTab = useMemo(() => {
    if (!pctParsed.ok || participants.length === 0) return [];
    const amounts: number[] = [];
    for (let i = 0; i < participants.length - 1; i++) {
      const w = pctParsed.map[participants[i]!.userId]!;
      amounts.push(round2((w / 100) * tabTotal));
    }
    const allocated = amounts.reduce((a, b) => a + b, 0);
    amounts.push(round2(tabTotal - allocated));
    return amounts;
  }, [pctParsed, participants, tabTotal]);

  function canConfirm(): boolean {
    if (tab === "equal") return true;
    if (tab === "shares") return shareParsed.ok;
    if (tab === "percent") return pctParsed.ok;
    return customParsed.ok;
  }

  function handleConfirm() {
    if (tab === "equal") {
      onConfirm({ splitType: "equal" });
      onOpenChange(false);
      return;
    }
    if (tab === "shares" && shareParsed.ok) {
      onConfirm({
        splitType: "shares",
        splits: participants.map((p) => ({
          userId: p.userId,
          weight: shareParsed.map[p.userId]!,
        })),
      });
      onOpenChange(false);
      return;
    }
    if (tab === "percent" && pctParsed.ok) {
      onConfirm({
        splitType: "percent",
        splits: participants.map((p) => ({
          userId: p.userId,
          weight: round2(pctParsed.map[p.userId]!),
        })),
      });
      onOpenChange(false);
      return;
    }
    if (tab === "custom" && customParsed.ok) {
      const expenseParts = participants.map((p) => customParsed.map[p.userId]!);
      const tabParts = expenseToTabAmounts(
        expenseParts,
        expenseTotal,
        tabTotal,
      );
      onConfirm({
        splitType: "custom",
        splits: participants.map((p, i) => ({
          userId: p.userId,
          amount: tabParts[i]!,
        })),
      });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,32rem)] max-w-[95vw] rounded-lg overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split expense</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-4 gap-0.5">
            <TabsTrigger value="equal" className="text-xs sm:text-sm">
              Equal
            </TabsTrigger>
            <TabsTrigger value="shares" className="text-xs sm:text-sm">
              Shares
            </TabsTrigger>
            <TabsTrigger value="percent" className="text-xs sm:text-sm">
              %
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs sm:text-sm">
              Custom
            </TabsTrigger>
          </TabsList>
          <TabsContent value="equal" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The total is split equally among {participants.length} participant
              {participants.length === 1 ? "" : "s"}.
            </p>
          </TabsContent>
          <TabsContent value="shares" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Larger shares get a larger portion.
            </p>
            {participants.map((p, i) => (
              <div key={p.userId} className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <UserAvatar userId={p.userId} size="xs" />
                  {getDisplayName(p.user, currentUserId)}
                </Label>
                <div
                  className={cn(
                    "flex h-9 w-full items-stretch overflow-hidden rounded-md border border-input bg-input-bg shadow-sm",
                    "focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-ring-offset",
                  )}
                >
                  <div className="flex h-9 min-w-0 w-24 shrink-0 items-center">
                    <ChartPie
                      className="ml-3 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      inputMode="numeric"
                      aria-label={`Shares for ${getDisplayName(p.user, currentUserId)}`}
                      className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                      value={shareStr[p.userId] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        if (t === "" || /^\d+$/.test(t)) {
                          setShareStr((prev) => ({ ...prev, [p.userId]: t }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-end border-l border-input px-3 text-right text-sm tabular-nums">
                    {shareParsed.ok && sharePreviewTab[i] != null ? (
                      <span className="text-muted-foreground">
                        <span className="text-muted-foreground">
                          {formatAmount(sharePreviewTab[i]!, tabCurrency)}
                        </span>
                        {showBothCurrencies ? (
                          <span className="ml-1.5 text-xs opacity-80">
                            (
                            {formatAmount(
                              expenseTotal > 0
                                ? (sharePreviewTab[i]! / tabTotal) *
                                    expenseTotal
                                : 0,
                              expenseCurrency,
                            )}
                            )
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="percent" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Must total 100%.</p>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  pctParsed.ok ? "text-positive" : "text-destructive",
                )}
              >
                {pctParsed.sum.toFixed(2)}%
              </span>
            </div>
            {participants.map((p, i) => (
              <div key={p.userId} className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <UserAvatar userId={p.userId} size="xs" />
                  {getDisplayName(p.user, currentUserId)}
                </Label>
                <div
                  className={cn(
                    "flex h-9 w-full items-stretch overflow-hidden rounded-md border border-input bg-input-bg shadow-sm",
                    "focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-ring-offset",
                  )}
                >
                  <div className="flex h-9 min-w-0 w-32 shrink-0 items-center">
                    <span className="shrink-0 pl-3 text-sm text-muted-foreground">
                      %
                    </span>
                    <Input
                      inputMode="decimal"
                      aria-label={`Percent for ${getDisplayName(p.user, currentUserId)}`}
                      className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent pl-1.5 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                      value={pctStr[p.userId] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        if (t === "" || /^\d*\.?\d{0,2}$/.test(t)) {
                          setPctStr((prev) => ({ ...prev, [p.userId]: t }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-end border-l border-input px-3 text-right text-sm tabular-nums">
                    {pctParsed.ok && pctPreviewTab[i] != null ? (
                      <span className="text-muted-foreground">
                        <span className="text-foreground">
                          {formatAmount(pctPreviewTab[i]!, tabCurrency)}
                        </span>
                        {showBothCurrencies ? (
                          <span className="ml-1.5 text-xs opacity-80">
                            (
                            {formatAmount(
                              expenseTotal > 0
                                ? (pctPreviewTab[i]! / tabTotal) * expenseTotal
                                : 0,
                              expenseCurrency,
                            )}
                            )
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="custom" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Amounts in {expenseCurrency} must sum to {expSym}
              {expenseTotal.toFixed(2)}.
            </p>
            {participants.map((p, i) => {
              const tabLine =
                customParsed.ok && expenseTotal > 0
                  ? expenseToTabAmounts(
                      participants.map((x) => customParsed.map[x.userId] ?? 0),
                      expenseTotal,
                      tabTotal,
                    )[i]
                  : null;
              return (
                <div key={p.userId} className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm">
                    <UserAvatar userId={p.userId} size="xs" />
                    {getDisplayName(p.user, currentUserId)}
                  </Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">
                      {expSym}
                    </span>
                    <Input
                      inputMode="decimal"
                      className="flex-1"
                      value={customStr[p.userId] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        if (t === "" || /^\d*\.?\d{0,2}$/.test(t)) {
                          setCustomStr((prev) => ({ ...prev, [p.userId]: t }));
                        }
                      }}
                    />
                  </div>
                  {showBothCurrencies && tabLine != null ? (
                    <p className="text-xs text-muted-foreground pl-0.5">
                      {tabSym}
                      {tabLine.toFixed(2)} in tab currency
                    </p>
                  ) : null}
                </div>
              );
            })}
            <p
              className={cn(
                "text-xs font-medium tabular-nums",
                customParsed.ok ? "text-muted-foreground" : "text-destructive",
              )}
            >
              Total: {expSym}
              {customParsed.sum.toFixed(2)} / {expSym}
              {expenseTotal.toFixed(2)}
            </p>
          </TabsContent>
        </Tabs>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm()}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

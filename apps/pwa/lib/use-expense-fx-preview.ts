import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { parseExpenseAmount } from "@/lib/expense-form";

type FxPreview = {
  amountTab: number;
  tabCurrency: string;
};

/**
 * Fetches tab-currency conversion for expense/settlement forms.
 * Depends on parsed amount (not the raw string) so blur formatting
 * (e.g. "213" -> "213.00") does not refetch.
 */
export function useExpenseFxPreview({
  tabId,
  tabCurrency,
  amount,
  currency,
  expenseDateMs,
}: {
  tabId: string;
  tabCurrency: string;
  amount: string;
  currency: string;
  expenseDateMs: number;
}) {
  const [fxPreview, setFxPreview] = useState<FxPreview | null>(null);
  const [fxPreviewLoading, setFxPreviewLoading] = useState(false);

  const parsedAmount = useMemo(() => parseExpenseAmount(amount), [amount]);

  useEffect(() => {
    if (parsedAmount === null || currency === tabCurrency) {
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
          amount: parsedAmount,
          currency,
          expenseDate: new Date(expenseDateMs).toISOString(),
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
  }, [parsedAmount, currency, expenseDateMs, tabId, tabCurrency]);

  const tabTotalForSplit = useMemo(() => {
    if (parsedAmount === null) return null;
    if (currency === tabCurrency) return parsedAmount;
    return fxPreview?.amountTab ?? null;
  }, [parsedAmount, currency, tabCurrency, fxPreview?.amountTab]);

  const splitButtonDisabled =
    parsedAmount === null ||
    (currency !== tabCurrency &&
      (fxPreviewLoading || tabTotalForSplit === null));

  return {
    fxPreview,
    fxPreviewLoading,
    parsedAmount,
    tabTotalForSplit,
    splitButtonDisabled,
  };
}

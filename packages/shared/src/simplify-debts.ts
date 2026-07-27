import { getCurrency, CURRENCIES } from "./currencies.js";

/** Net balance for one participant. Positive = is owed; negative = owes. */
export type NetBalance = {
  participantId: string;
  amount: number;
};

/** Suggested pairwise payment: `from` pays `to` this amount. */
export type DebtTransfer = {
  fromParticipantId: string;
  toParticipantId: string;
  /** Major units (e.g. dollars), exact to the currency's precision. */
  amount: number;
};

export type SimplifyDebtsResult = {
  transfers: DebtTransfer[];
  /**
   * Leftover that no transfer can settle, in **minor units** (e.g. cents) —
   * unlike `DebtTransfer.amount`, which is major units.
   *
   * Non-zero only when the input balances don't sum to zero, which means the
   * ledger itself is inconsistent (a split that doesn't add up to its expense).
   * Positive = unmatched credit, negative = unmatched debt. Callers showing a
   * net alongside these transfers should expect the two to differ by exactly
   * this much.
   */
  residualMinorUnits: number;
};

export type SimplifyDebtsOptions = {
  /** ISO code used for precision. Unknown or omitted falls back to USD (2dp). */
  currency?: string | null;
};

/**
 * Turn net balances into pairwise transfers (debtors pay creditors) that clear
 * everyone.
 *
 * Uses a greedy largest-debtor/largest-creditor heuristic. Minimising the
 * number of transfers is NP-hard, so this is not guaranteed optimal — it is
 * close in practice and stable for a given input.
 *
 * All arithmetic runs in integer minor units, so the transfers always sum back
 * to each participant's rounded balance with no floating-point drift and no
 * sub-currency-unit rows.
 */
export function simplifyDebts(
  balances: NetBalance[],
  options?: SimplifyDebtsOptions,
): SimplifyDebtsResult {
  const digits = (getCurrency(options?.currency ?? "USD") ?? CURRENCIES.USD)
    .decimal_digits;
  const scale = Math.pow(10, digits);
  const toMinor = (amount: number) => Math.round(amount * scale);

  // Sorted largest-first so the biggest obligations are matched up first;
  // participantId breaks ties to keep the output stable across renders.
  const bySizeThenId = (
    a: { participantId: string; amount: number },
    b: { participantId: string; amount: number },
  ) => b.amount - a.amount || a.participantId.localeCompare(b.participantId);

  const scaled = balances.map((b) => ({
    participantId: b.participantId,
    amount: toMinor(b.amount),
  }));

  const debtors = scaled
    .filter((b) => b.amount < 0)
    .map((b) => ({ participantId: b.participantId, amount: -b.amount }))
    .sort(bySizeThenId);

  const creditors = scaled
    .filter((b) => b.amount > 0)
    .map((b) => ({ participantId: b.participantId, amount: b.amount }))
    .sort(bySizeThenId);

  const transfers: DebtTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const pay = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromParticipantId: debtor.participantId,
      toParticipantId: creditor.participantId,
      amount: pay / scale,
    });

    // `pay` is the min, so at least one side reaches zero and advances —
    // the loop always makes progress.
    debtor.amount -= pay;
    creditor.amount -= pay;
    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  let residualMinorUnits = 0;
  for (let k = i; k < debtors.length; k++) {
    residualMinorUnits -= debtors[k]!.amount;
  }
  for (let k = j; k < creditors.length; k++) {
    residualMinorUnits += creditors[k]!.amount;
  }

  return { transfers, residualMinorUnits };
}

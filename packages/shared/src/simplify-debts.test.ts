import { describe, expect, test } from "vitest";
import { simplifyDebts, type NetBalance } from "./simplify-debts.js";

/**
 * Replay transfers to check each participant ends at their stated balance.
 * Accumulates in minor units — summing major-unit floats would reintroduce
 * the very drift these transfers are built to avoid.
 */
function settle(
  balances: NetBalance[],
  options?: { currency?: string; decimalDigits?: number },
) {
  const { transfers, residualMinorUnits } = simplifyDebts(balances, options);
  const scale = Math.pow(10, options?.decimalDigits ?? 2);
  const minor: Record<string, number> = {};
  for (const b of balances) minor[b.participantId] = 0;
  for (const t of transfers) {
    const cents = Math.round(t.amount * scale);
    minor[t.fromParticipantId] = (minor[t.fromParticipantId] ?? 0) - cents;
    minor[t.toParticipantId] = (minor[t.toParticipantId] ?? 0) + cents;
  }
  const net = Object.fromEntries(
    Object.entries(minor).map(([id, cents]) => [id, cents / scale]),
  );
  return { transfers, residualMinorUnits, net };
}

describe("simplifyDebts", () => {
  test("returns nothing when everyone is settled", () => {
    expect(simplifyDebts([])).toEqual({
      transfers: [],
      residualMinorUnits: 0,
    });
    expect(
      simplifyDebts([
        { participantId: "a", amount: 0 },
        { participantId: "b", amount: 0.0001 },
      ]),
    ).toEqual({ transfers: [], residualMinorUnits: 0 });
  });

  test("two people: debtor pays creditor the net", () => {
    expect(
      simplifyDebts([
        { participantId: "you", amount: 100 },
        { participantId: "friend", amount: -100 },
      ]),
    ).toEqual({
      transfers: [
        {
          fromParticipantId: "friend",
          toParticipantId: "you",
          amount: 100,
        },
      ],
      residualMinorUnits: 0,
    });
  });

  test("one creditor and two debtors", () => {
    const { transfers, residualMinorUnits } = simplifyDebts([
      { participantId: "you", amount: 3345.25 },
      { participantId: "friend1", amount: -2560.91 },
      { participantId: "parth3", amount: -784.34 },
    ]);

    expect(transfers).toEqual([
      {
        fromParticipantId: "friend1",
        toParticipantId: "you",
        amount: 2560.91,
      },
      {
        fromParticipantId: "parth3",
        toParticipantId: "you",
        amount: 784.34,
      },
    ]);
    expect(residualMinorUnits).toBe(0);
    expect(transfers.reduce((sum, t) => sum + t.amount, 0)).toBeCloseTo(
      3345.25,
      2,
    );
  });

  test("includes transfers between other members", () => {
    // you +50, alice +30, bob -80 → bob pays you 50, bob pays alice 30
    const { transfers } = simplifyDebts([
      { participantId: "you", amount: 50 },
      { participantId: "alice", amount: 30 },
      { participantId: "bob", amount: -80 },
    ]);

    expect(transfers).toEqual([
      { fromParticipantId: "bob", toParticipantId: "you", amount: 50 },
      { fromParticipantId: "bob", toParticipantId: "alice", amount: 30 },
    ]);
  });

  test("multiple creditors and debtors clear to zero", () => {
    const { net, residualMinorUnits, transfers } = settle([
      { participantId: "a", amount: 40 },
      { participantId: "b", amount: 60 },
      { participantId: "c", amount: -25 },
      { participantId: "d", amount: -75 },
    ]);

    expect(net).toEqual({ a: 40, b: 60, c: -25, d: -75 });
    expect(residualMinorUnits).toBe(0);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  test("repeating decimals reconstruct exactly, with no drift", () => {
    // $200 three ways: payer is owed 133.33, each debtor owes 66.665 → 66.67/66.66
    const { net, residualMinorUnits } = settle([
      { participantId: "a", amount: 133.33 },
      { participantId: "b", amount: -66.666666666 },
      { participantId: "c", amount: -66.663333334 },
    ]);

    // Exact equality, not toBeCloseTo: integer minor units leave no drift.
    expect(net.a).toBe(133.33);
    expect(net.b).toBe(-66.67);
    expect(net.c).toBe(-66.66);
    expect(residualMinorUnits).toBe(0);
  });

  test("never emits a transfer that rounds away to nothing", () => {
    const { transfers } = simplifyDebts([
      { participantId: "a", amount: 0.002 },
      { participantId: "b", amount: -0.002 },
    ]);

    expect(transfers).toEqual([]);
  });

  test("reports leftover credit when balances do not sum to zero", () => {
    const { transfers, residualMinorUnits } = simplifyDebts([
      { participantId: "a", amount: 50 },
      { participantId: "b", amount: -25 },
      { participantId: "c", amount: -24.99 },
    ]);

    expect(transfers).toEqual([
      { fromParticipantId: "b", toParticipantId: "a", amount: 25 },
      { fromParticipantId: "c", toParticipantId: "a", amount: 24.99 },
    ]);
    // A cent of credit nobody owes: the ledger itself is short.
    expect(residualMinorUnits).toBe(1);
  });

  test("reports leftover debt when balances do not sum to zero", () => {
    const { residualMinorUnits } = simplifyDebts([
      { participantId: "a", amount: 24.99 },
      { participantId: "b", amount: -25 },
    ]);

    expect(residualMinorUnits).toBe(-1);
  });

  test("reports the full amount when there are creditors but no debtors", () => {
    expect(
      simplifyDebts([
        { participantId: "a", amount: 10 },
        { participantId: "b", amount: 5 },
      ]),
    ).toEqual({ transfers: [], residualMinorUnits: 1500 });
  });

  test("respects zero-decimal currencies", () => {
    const { transfers, residualMinorUnits } = simplifyDebts(
      [
        { participantId: "a", amount: 1000.4 },
        { participantId: "b", amount: -1000.4 },
      ],
      { currency: "JPY" },
    );

    expect(transfers).toEqual([
      { fromParticipantId: "b", toParticipantId: "a", amount: 1000 },
    ]);
    expect(residualMinorUnits).toBe(0);
  });

  test("unknown currency falls back to two decimals", () => {
    const { transfers } = simplifyDebts(
      [
        { participantId: "a", amount: 10.55 },
        { participantId: "b", amount: -10.55 },
      ],
      { currency: "NOPE" },
    );

    expect(transfers).toEqual([
      { fromParticipantId: "b", toParticipantId: "a", amount: 10.55 },
    ]);
  });

  test("is stable and terminates on a larger group", () => {
    const balances: NetBalance[] = [
      { participantId: "a", amount: 120.55 },
      { participantId: "b", amount: 45.1 },
      { participantId: "c", amount: 3.35 },
      { participantId: "d", amount: -60 },
      { participantId: "e", amount: -59 },
      { participantId: "f", amount: -50 },
    ];
    const first = settle(balances);

    expect(first.net).toEqual({
      a: 120.55,
      b: 45.1,
      c: 3.35,
      d: -60,
      e: -59,
      f: -50,
    });
    expect(first.residualMinorUnits).toBe(0);
    // At most n-1 transfers for n participants.
    expect(first.transfers.length).toBeLessThanOrEqual(balances.length - 1);
    // Same input, same output — order does not drift between renders.
    expect(simplifyDebts([...balances].reverse()).transfers).toEqual(
      first.transfers,
    );
  });
});

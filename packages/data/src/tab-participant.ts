import {
  db,
  tab as tabTable,
  tabMember,
  tabParticipant as tabParticipantTable,
  tabEvent as tabEventTable,
  expense as expenseTable,
  expenseSplit,
  expenseAuditLog,
  settlement as settlementTable,
  recurringExpenseRule,
  user,
} from "db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createId } from "shared";

export type TabParticipantRow = {
  id: string;
  tabId: string;
  kind: string;
  userId: string | null;
  displayName: string;
  mergedIntoParticipantId: string | null;
  mergedAt: Date | null;
};

async function getMemberDisplayName(
  client: typeof db,
  userId: string,
): Promise<string> {
  const [u] = await client
    .select({ name: user.name, email: user.email, username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!u) return "Member";
  return (
    u.name?.trim() ||
    (u.username ? `@${u.username}` : null) ||
    u.email ||
    "Member"
  );
}

/** Ensure each tab_member has a tab_participant row (kind=member). */
export async function ensureMemberParticipantsForTab(tabId: string): Promise<void> {
  const members = await db
    .select({ userId: tabMember.userId })
    .from(tabMember)
    .where(eq(tabMember.tabId, tabId));

  for (const m of members) {
    const [existing] = await db
      .select({ id: tabParticipantTable.id })
      .from(tabParticipantTable)
      .where(
        and(
          eq(tabParticipantTable.tabId, tabId),
          eq(tabParticipantTable.userId, m.userId),
        ),
      )
      .limit(1);
    if (existing) continue;

    const displayName = await getMemberDisplayName(db, m.userId);
    await db.insert(tabParticipantTable).values({
      tabId,
      kind: "member",
      userId: m.userId,
      displayName,
      createdByUserId: m.userId,
    });
  }
}

export async function getParticipantIdForTabUser(
  tabId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: tabParticipantTable.id })
    .from(tabParticipantTable)
    .where(
      and(
        eq(tabParticipantTable.tabId, tabId),
        eq(tabParticipantTable.userId, userId),
        isNull(tabParticipantTable.mergedIntoParticipantId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function listActiveParticipantsForTab(
  tabId: string,
): Promise<TabParticipantRow[]> {
  await ensureMemberParticipantsForTab(tabId);
  const rows = await db
    .select({
      id: tabParticipantTable.id,
      tabId: tabParticipantTable.tabId,
      kind: tabParticipantTable.kind,
      userId: tabParticipantTable.userId,
      displayName: tabParticipantTable.displayName,
      mergedIntoParticipantId: tabParticipantTable.mergedIntoParticipantId,
      mergedAt: tabParticipantTable.mergedAt,
    })
    .from(tabParticipantTable)
    .where(
      and(
        eq(tabParticipantTable.tabId, tabId),
        isNull(tabParticipantTable.mergedIntoParticipantId),
      ),
    )
    .orderBy(tabParticipantTable.createdAt);
  return rows.map((r) => ({
    ...r,
    userId: r.userId ?? null,
    mergedIntoParticipantId: r.mergedIntoParticipantId ?? null,
    mergedAt: r.mergedAt ?? null,
  }));
}

export async function getParticipantById(
  participantId: string,
): Promise<TabParticipantRow | null> {
  const [row] = await db
    .select({
      id: tabParticipantTable.id,
      tabId: tabParticipantTable.tabId,
      kind: tabParticipantTable.kind,
      userId: tabParticipantTable.userId,
      displayName: tabParticipantTable.displayName,
      mergedIntoParticipantId: tabParticipantTable.mergedIntoParticipantId,
      mergedAt: tabParticipantTable.mergedAt,
    })
    .from(tabParticipantTable)
    .where(eq(tabParticipantTable.id, participantId))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    userId: row.userId ?? null,
    mergedIntoParticipantId: row.mergedIntoParticipantId ?? null,
    mergedAt: row.mergedAt ?? null,
  };
}

export async function createPlaceholderParticipant(input: {
  tabId: string;
  displayName: string;
  createdByUserId: string;
}): Promise<string> {
  await ensureMemberParticipantsForTab(input.tabId);
  const [inserted] = await db
    .insert(tabParticipantTable)
    .values({
      tabId: input.tabId,
      kind: "placeholder",
      userId: null,
      displayName: input.displayName.trim(),
      createdByUserId: input.createdByUserId,
    })
    .returning({ id: tabParticipantTable.id });
  return inserted!.id;
}

export async function renamePlaceholderParticipant(input: {
  participantId: string;
  tabId: string;
  displayName: string;
}): Promise<void> {
  const [p] = await db
    .select({ id: tabParticipantTable.id })
    .from(tabParticipantTable)
    .where(
      and(
        eq(tabParticipantTable.id, input.participantId),
        eq(tabParticipantTable.tabId, input.tabId),
        eq(tabParticipantTable.kind, "placeholder"),
        isNull(tabParticipantTable.mergedIntoParticipantId),
      ),
    )
    .limit(1);
  if (!p) throw new Error("Placeholder not found");
  await db
    .update(tabParticipantTable)
    .set({ displayName: input.displayName.trim(), updatedAt: new Date() })
    .where(eq(tabParticipantTable.id, input.participantId));
}

/** Backfill paidByParticipantId / split participantId / settlement participant ids from legacy user ids. */
export async function backfillLedgerParticipantIdsForTab(tabId: string): Promise<void> {
  await ensureMemberParticipantsForTab(tabId);

  const participants = await db
    .select({
      id: tabParticipantTable.id,
      userId: tabParticipantTable.userId,
    })
    .from(tabParticipantTable)
    .where(
      and(
        eq(tabParticipantTable.tabId, tabId),
        isNull(tabParticipantTable.mergedIntoParticipantId),
      ),
    );
  const userToParticipant = new Map<string, string>();
  for (const p of participants) {
    if (p.userId) userToParticipant.set(p.userId, p.id);
  }

  const expensesNeedingPayer = await db
    .select({ id: expenseTable.id, paidById: expenseTable.paidById })
    .from(expenseTable)
    .where(
      and(
        eq(expenseTable.tabId, tabId),
        isNull(expenseTable.paidByParticipantId),
        sql`${expenseTable.paidById} IS NOT NULL`,
      ),
    );

  for (const e of expensesNeedingPayer) {
    if (!e.paidById) continue;
    const pid = userToParticipant.get(e.paidById);
    if (pid) {
      await db
        .update(expenseTable)
        .set({ paidByParticipantId: pid })
        .where(eq(expenseTable.id, e.id));
    }
  }

  const splitsNeeding = await db
    .select({
      id: expenseSplit.id,
      userId: expenseSplit.userId,
    })
    .from(expenseSplit)
    .innerJoin(expenseTable, eq(expenseSplit.expenseId, expenseTable.id))
    .where(
      and(
        eq(expenseTable.tabId, tabId),
        isNull(expenseSplit.participantId),
        sql`${expenseSplit.userId} IS NOT NULL`,
      ),
    );

  for (const s of splitsNeeding) {
    if (!s.userId) continue;
    const pid = userToParticipant.get(s.userId);
    if (pid) {
      await db
        .update(expenseSplit)
        .set({ participantId: pid })
        .where(eq(expenseSplit.id, s.id));
    }
  }

  const settlementsNeeding = await db
    .select({
      id: settlementTable.id,
      fromUserId: settlementTable.fromUserId,
      toUserId: settlementTable.toUserId,
      fromParticipantId: settlementTable.fromParticipantId,
      toParticipantId: settlementTable.toParticipantId,
    })
    .from(settlementTable)
    .where(
      and(
        eq(settlementTable.tabId, tabId),
        or(
          isNull(settlementTable.fromParticipantId),
          isNull(settlementTable.toParticipantId),
        ),
      ),
    );

  for (const s of settlementsNeeding) {
    const patch: { fromParticipantId?: string; toParticipantId?: string } = {};
    if (s.fromUserId && !s.fromParticipantId) {
      const fromPid = userToParticipant.get(s.fromUserId);
      if (fromPid) patch.fromParticipantId = fromPid;
    }
    if (s.toUserId && !s.toParticipantId) {
      const toPid = userToParticipant.get(s.toUserId);
      if (toPid) patch.toParticipantId = toPid;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(settlementTable).set(patch).where(eq(settlementTable.id, s.id));
    }
  }
}

function deepReplaceId(obj: unknown, fromId: string, toId: string): unknown {
  if (obj === fromId) return toId;
  if (Array.isArray(obj)) {
    const next = obj.map((x) => deepReplaceId(x, fromId, toId));
    if (next.every((x) => typeof x === "string")) {
      const uniq: string[] = [];
      const seen = new Set<string>();
      for (const x of next as string[]) {
        if (!seen.has(x)) {
          seen.add(x);
          uniq.push(x);
        }
      }
      return uniq;
    }
    return next;
  }
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = deepReplaceId(v, fromId, toId);
    }
    return out;
  }
  return obj;
}

export type MergePlaceholderResult = {
  affectedExpenseIds: string[];
  tabName: string;
  placeholderDisplayName: string;
  targetUserId: string;
  targetDisplayName: string;
};

export async function mergePlaceholderIntoMember(input: {
  tabId: string;
  placeholderParticipantId: string;
  targetUserId: string;
  performedByUserId: string;
}): Promise<MergePlaceholderResult> {
  await ensureMemberParticipantsForTab(input.tabId);
  await backfillLedgerParticipantIdsForTab(input.tabId);

  return db.transaction(async (tx) => {
    const [tabRow] = await tx
      .select({ name: tabTable.name })
      .from(tabTable)
      .where(eq(tabTable.id, input.tabId))
      .limit(1);
    const tabName = tabRow?.name ?? "Tab";

    const [ph] = await tx
      .select()
      .from(tabParticipantTable)
      .where(
        and(
          eq(tabParticipantTable.id, input.placeholderParticipantId),
          eq(tabParticipantTable.tabId, input.tabId),
          eq(tabParticipantTable.kind, "placeholder"),
          isNull(tabParticipantTable.mergedIntoParticipantId),
        ),
      )
      .limit(1);
    if (!ph) throw new Error("Placeholder not found");

    const [targetMember] = await tx
      .select({ userId: tabMember.userId })
      .from(tabMember)
      .where(
        and(eq(tabMember.tabId, input.tabId), eq(tabMember.userId, input.targetUserId)),
      )
      .limit(1);
    if (!targetMember) throw new Error("Target is not a tab member");

    let [targetParticipant] = await tx
      .select({ id: tabParticipantTable.id, displayName: tabParticipantTable.displayName })
      .from(tabParticipantTable)
      .where(
        and(
          eq(tabParticipantTable.tabId, input.tabId),
          eq(tabParticipantTable.userId, input.targetUserId),
          isNull(tabParticipantTable.mergedIntoParticipantId),
        ),
      )
      .limit(1);

    if (!targetParticipant) {
      const displayName = await getMemberDisplayName(db, input.targetUserId);
      const [ins] = await tx
        .insert(tabParticipantTable)
        .values({
          tabId: input.tabId,
          kind: "member",
          userId: input.targetUserId,
          displayName,
          createdByUserId: input.performedByUserId,
        })
        .returning({ id: tabParticipantTable.id, displayName: tabParticipantTable.displayName });
      targetParticipant = { id: ins!.id, displayName: ins!.displayName };
    }

    const targetPid = targetParticipant.id;
    const placeholderPid = ph.id;
    const placeholderDisplayName = ph.displayName;

    const [targetUserRow] = await tx
      .select({ name: user.name, email: user.email, username: user.username })
      .from(user)
      .where(eq(user.id, input.targetUserId))
      .limit(1);
    const targetDisplayName =
      targetUserRow?.name?.trim() ||
      (targetUserRow?.username ? `@${targetUserRow.username}` : null) ||
      targetUserRow?.email ||
      "Member";

    const placeholderSplitExpenses = await tx
      .select({
        expenseId: expenseSplit.expenseId,
      })
      .from(expenseSplit)
      .innerJoin(expenseTable, eq(expenseSplit.expenseId, expenseTable.id))
      .where(
        and(
          eq(expenseTable.tabId, input.tabId),
          eq(expenseSplit.participantId, placeholderPid),
        ),
      );
    const fromSplits = [...new Set(placeholderSplitExpenses.map((r) => r.expenseId))];

    const expenseIdsFromPayer = await tx
      .select({ id: expenseTable.id })
      .from(expenseTable)
      .where(
        and(
          eq(expenseTable.tabId, input.tabId),
          eq(expenseTable.paidByParticipantId, placeholderPid),
        ),
      );

    const affectedSet = new Set<string>();
    for (const r of fromSplits) affectedSet.add(r);
    for (const r of expenseIdsFromPayer) affectedSet.add(r.id);
    const affectedExpenseIds = [...affectedSet];

    const mergePayload = {
      placeholderParticipantId: placeholderPid,
      placeholderDisplayName,
      targetParticipantId: targetPid,
      targetUserId: input.targetUserId,
      targetDisplayName,
      performedByUserId: input.performedByUserId,
    };

    await tx
      .update(expenseTable)
      .set({ paidByParticipantId: targetPid, paidById: input.targetUserId })
      .where(
        and(
          eq(expenseTable.tabId, input.tabId),
          eq(expenseTable.paidByParticipantId, placeholderPid),
        ),
      );

    const placeholderSplitsToMerge = await tx
      .select({
        id: expenseSplit.id,
        expenseId: expenseSplit.expenseId,
        amount: expenseSplit.amount,
        weight: expenseSplit.weight,
      })
      .from(expenseSplit)
      .innerJoin(expenseTable, eq(expenseSplit.expenseId, expenseTable.id))
      .where(
        and(
          eq(expenseTable.tabId, input.tabId),
          eq(expenseSplit.participantId, placeholderPid),
        ),
      );

    for (const split of placeholderSplitsToMerge) {
      const [existingTargetSplit] = await tx
        .select()
        .from(expenseSplit)
        .where(
          and(
            eq(expenseSplit.expenseId, split.expenseId),
            eq(expenseSplit.participantId, targetPid),
          ),
        )
        .limit(1);

      if (existingTargetSplit) {
        const mergedAmount =
          Number(existingTargetSplit.amount) + Number(split.amount);
        const w1 =
          existingTargetSplit.weight != null ? Number(existingTargetSplit.weight) : null;
        const w2 = split.weight != null ? Number(split.weight) : null;
        const mergedWeight =
          w1 != null && w2 != null ? w1 + w2 : existingTargetSplit.weight ?? split.weight;
        await tx
          .update(expenseSplit)
          .set({
            amount: mergedAmount.toString(),
            weight: mergedWeight != null ? String(mergedWeight) : null,
            userId: input.targetUserId,
          })
          .where(eq(expenseSplit.id, existingTargetSplit.id));
        await tx.delete(expenseSplit).where(eq(expenseSplit.id, split.id));
      } else {
        await tx
          .update(expenseSplit)
          .set({
            participantId: targetPid,
            userId: input.targetUserId,
          })
          .where(eq(expenseSplit.id, split.id));
      }
    }

    await tx
      .update(settlementTable)
      .set({ fromParticipantId: targetPid, fromUserId: input.targetUserId })
      .where(
        and(
          eq(settlementTable.tabId, input.tabId),
          eq(settlementTable.fromParticipantId, placeholderPid),
        ),
      );

    await tx
      .update(settlementTable)
      .set({ toParticipantId: targetPid, toUserId: input.targetUserId })
      .where(
        and(
          eq(settlementTable.tabId, input.tabId),
          eq(settlementTable.toParticipantId, placeholderPid),
        ),
      );

    const rules = await tx
      .select()
      .from(recurringExpenseRule)
      .where(eq(recurringExpenseRule.tabId, input.tabId));

    for (const rule of rules) {
      const template = rule.template as Record<string, unknown>;
      const next = deepReplaceId(template, placeholderPid, targetPid) as Record<
        string,
        unknown
      >;
      if (JSON.stringify(next) !== JSON.stringify(template)) {
        if (next.paidByParticipantId === targetPid) {
          next.paidById = input.targetUserId;
        }
        await tx
          .update(recurringExpenseRule)
          .set({ template: next, updatedAt: new Date() })
          .where(eq(recurringExpenseRule.id, rule.id));
      }
    }

    await tx.insert(tabEventTable).values({
      tabId: input.tabId,
      type: "placeholder_merged",
      performedByUserId: input.performedByUserId,
      payload: mergePayload,
    });

    for (const expenseId of affectedExpenseIds) {
      await tx.insert(expenseAuditLog).values({
        id: createId(),
        expenseId,
        tabId: input.tabId,
        action: "placeholder_merge",
        performedById: input.performedByUserId,
        changes: mergePayload as unknown as Record<string, unknown>,
      });
    }

    await tx
      .update(tabParticipantTable)
      .set({
        mergedIntoParticipantId: targetPid,
        mergedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tabParticipantTable.id, placeholderPid));

    return {
      affectedExpenseIds,
      tabName,
      placeholderDisplayName,
      targetUserId: input.targetUserId,
      targetDisplayName,
    };
  });
}

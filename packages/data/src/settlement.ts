import {
  db,
  settlement as settlementTable,
  settlementAuditLog,
  user,
} from "db";
import { eq, desc, inArray } from "drizzle-orm";

export type RecordSettlementInput = {
  tabId: string;
  fromUserId: string;
  toUserId: string;
  /** Ledger total in tab currency. */
  amount: number;
  /** When foreign, ISO code of the entered amount. */
  currency?: string | null;
  /** Entered amount when `currency` is set and differs from tab currency. */
  originalAmount?: number | null;
  /** Payment date (FX and display). */
  settlementDate: Date;
  performedById: string;
};

export type UpdateSettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency?: string | null;
  originalAmount?: number | null;
  settlementDate: Date;
  performedById: string;
};

/** Return type of getById / getForTab. Use string | Date for JSON API responses. */
export type Settlement = {
  id: string;
  tabId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string | null;
  originalAmount: number | null;
  settlementDate: Date;
  createdAt: Date;
  fromUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  toUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

/** Return type of getAuditLog. Use string | Date for JSON API responses. */
export type SettlementAuditLogEntry = {
  id: string;
  settlementId: string;
  tabId: string;
  action: "create" | "update" | "delete";
  performedById: string;
  performedAt: Date;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  performedBy: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

function settlementCurrencyKey(c: string | null | undefined): string | null {
  if (c == null || String(c).trim() === "") return null;
  return String(c).trim().toUpperCase();
}

function amountsEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export const settlement = {
  getForTab: async (tabId: string) => {
    const rows = await db
      .select({
        id: settlementTable.id,
        tabId: settlementTable.tabId,
        fromUserId: settlementTable.fromUserId,
        toUserId: settlementTable.toUserId,
        amount: settlementTable.amount,
        currency: settlementTable.currency,
        originalAmount: settlementTable.originalAmount,
        settlementDate: settlementTable.settlementDate,
        createdAt: settlementTable.createdAt,
        fromUserEmail: user.email,
        fromUserName: user.name,
        fromUserUsername: user.username,
      })
      .from(settlementTable)
      .innerJoin(user, eq(settlementTable.fromUserId, user.id))
      .where(eq(settlementTable.tabId, tabId))
      .orderBy(
        desc(settlementTable.settlementDate),
        desc(settlementTable.createdAt),
      );

    const toUserIds = [...new Set(rows.map((r) => r.toUserId))];
    const toUsers =
      toUserIds.length > 0
        ? await db
            .select({
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
            })
            .from(user)
            .where(inArray(user.id, toUserIds))
        : [];
    const toUserMap = Object.fromEntries(toUsers.map((u) => [u.id, u]));

    return rows.map((r) => ({
      id: r.id,
      tabId: r.tabId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      amount: Number(r.amount),
      currency: r.currency ?? null,
      originalAmount:
        r.originalAmount != null ? Number(r.originalAmount) : null,
      settlementDate: r.settlementDate,
      createdAt: r.createdAt,
      fromUser: {
        id: r.fromUserId,
        email: r.fromUserEmail,
        name: r.fromUserName,
        username: r.fromUserUsername,
      },
      toUser: toUserMap[r.toUserId]
        ? {
            id: toUserMap[r.toUserId].id,
            email: toUserMap[r.toUserId].email,
            name: toUserMap[r.toUserId].name,
            username: toUserMap[r.toUserId].username,
          }
        : {
            id: r.toUserId,
            email: "",
            name: null,
            username: null,
          },
    }));
  },

  getById: async (settlementId: string) => {
    const [row] = await db
      .select({
        id: settlementTable.id,
        tabId: settlementTable.tabId,
        fromUserId: settlementTable.fromUserId,
        toUserId: settlementTable.toUserId,
        amount: settlementTable.amount,
        currency: settlementTable.currency,
        originalAmount: settlementTable.originalAmount,
        settlementDate: settlementTable.settlementDate,
        createdAt: settlementTable.createdAt,
        fromUserEmail: user.email,
        fromUserName: user.name,
        fromUserUsername: user.username,
      })
      .from(settlementTable)
      .innerJoin(user, eq(settlementTable.fromUserId, user.id))
      .where(eq(settlementTable.id, settlementId))
      .limit(1);

    if (!row) return null;

    const [toUser] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      })
      .from(user)
      .where(eq(user.id, row.toUserId))
      .limit(1);

    return {
      id: row.id,
      tabId: row.tabId,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      amount: Number(row.amount),
      currency: row.currency ?? null,
      originalAmount:
        row.originalAmount != null ? Number(row.originalAmount) : null,
      settlementDate: row.settlementDate,
      createdAt: row.createdAt,
      fromUser: {
        id: row.fromUserId,
        email: row.fromUserEmail,
        name: row.fromUserName,
        username: row.fromUserUsername,
      },
      toUser: toUser
        ? {
            id: toUser.id,
            email: toUser.email,
            name: toUser.name,
            username: toUser.username,
          }
        : {
            id: row.toUserId,
            email: "",
            name: null,
            username: null,
          },
    };
  },

  getAuditLog: async (settlementId: string) => {
    const rows = await db
      .select({
        id: settlementAuditLog.id,
        settlementId: settlementAuditLog.settlementId,
        tabId: settlementAuditLog.tabId,
        action: settlementAuditLog.action,
        performedById: settlementAuditLog.performedById,
        performedAt: settlementAuditLog.performedAt,
        changes: settlementAuditLog.changes,
        performedByEmail: user.email,
        performedByName: user.name,
        performedByUsername: user.username,
      })
      .from(settlementAuditLog)
      .innerJoin(user, eq(settlementAuditLog.performedById, user.id))
      .where(eq(settlementAuditLog.settlementId, settlementId))
      .orderBy(desc(settlementAuditLog.performedAt));

    return rows.map((r) => ({
      id: r.id,
      settlementId: r.settlementId,
      tabId: r.tabId,
      action: r.action as "create" | "update" | "delete",
      performedById: r.performedById,
      performedAt: r.performedAt,
      changes: r.changes as Record<string, { from: unknown; to: unknown }> | null,
      performedBy: {
        id: r.performedById,
        email: r.performedByEmail,
        name: r.performedByName,
        username: r.performedByUsername,
      },
    }));
  },

  record: async (input: RecordSettlementInput): Promise<string> => {
    const [inserted] = await db
      .insert(settlementTable)
      .values({
        tabId: input.tabId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount.toString(),
        currency: input.currency ?? null,
        originalAmount:
          input.originalAmount != null
            ? input.originalAmount.toString()
            : null,
        settlementDate: input.settlementDate,
      })
      .returning({ id: settlementTable.id });
    const settlementId = inserted!.id;

    await db.insert(settlementAuditLog).values({
      settlementId,
      tabId: input.tabId,
      action: "create",
      performedById: input.performedById,
      changes: null,
    });

    return settlementId;
  },

  update: async (
    settlementId: string,
    tabId: string,
    input: UpdateSettlementInput,
  ): Promise<void> => {
    const prior = await settlement.getById(settlementId);
    if (!prior || prior.tabId !== tabId) {
      throw new Error("Settlement not found");
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (prior.fromUserId !== input.fromUserId) {
      changes.fromUserId = { from: prior.fromUserId, to: input.fromUserId };
    }
    if (prior.toUserId !== input.toUserId) {
      changes.toUserId = { from: prior.toUserId, to: input.toUserId };
    }
    if (!amountsEqual(prior.amount, input.amount)) {
      changes.amount = { from: prior.amount, to: input.amount };
    }
    if (
      settlementCurrencyKey(prior.currency) !==
      settlementCurrencyKey(input.currency ?? null)
    ) {
      changes.currency = { from: prior.currency, to: input.currency ?? null };
    }
    const priorOa = prior.originalAmount;
    const nextOa = input.originalAmount ?? null;
    if (priorOa == null && nextOa == null) {
      /* no original-amount change */
    } else if (priorOa == null || nextOa == null) {
      changes.originalAmount = { from: priorOa, to: nextOa };
    } else if (!amountsEqual(priorOa, nextOa)) {
      changes.originalAmount = { from: priorOa, to: nextOa };
    }
    if (prior.settlementDate.getTime() !== input.settlementDate.getTime()) {
      changes.settlementDate = {
        from: prior.settlementDate,
        to: input.settlementDate,
      };
    }

    await db
      .update(settlementTable)
      .set({
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount.toString(),
        currency: input.currency ?? null,
        originalAmount:
          input.originalAmount != null
            ? input.originalAmount.toString()
            : null,
        settlementDate: input.settlementDate,
      })
      .where(eq(settlementTable.id, settlementId));

    await db.insert(settlementAuditLog).values({
      settlementId,
      tabId,
      action: "update",
      performedById: input.performedById,
      changes:
        Object.keys(changes).length > 0
          ? (changes as unknown as Record<string, unknown>)
          : null,
    });
  },

  delete: async (
    settlementId: string,
    tabId: string,
    performedById: string,
  ): Promise<void> => {
    await db.insert(settlementAuditLog).values({
      settlementId,
      tabId,
      action: "delete",
      performedById,
      changes: null,
    });

    await db.delete(settlementTable).where(eq(settlementTable.id, settlementId));
  },
};

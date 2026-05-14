import {
  db,
  settlement as settlementTable,
  settlementAuditLog,
  user,
  tabParticipant,
} from "db";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const settlementFromUser = alias(user, "settlement_from_user");
const settlementToUser = alias(user, "settlement_to_user");
const settlementFromParticipant = alias(tabParticipant, "settlement_from_participant");
const settlementToParticipant = alias(tabParticipant, "settlement_to_participant");

export type RecordSettlementInput = {
  tabId: string;
  fromUserId: string | null;
  toUserId: string | null;
  fromParticipantId: string;
  toParticipantId: string;
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
  fromUserId: string | null;
  toUserId: string | null;
  fromParticipantId: string;
  toParticipantId: string;
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
  fromUserId: string | null;
  toUserId: string | null;
  fromParticipantId: string | null;
  toParticipantId: string | null;
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
        fromParticipantId: settlementTable.fromParticipantId,
        toParticipantId: settlementTable.toParticipantId,
        amount: settlementTable.amount,
        currency: settlementTable.currency,
        originalAmount: settlementTable.originalAmount,
        settlementDate: settlementTable.settlementDate,
        createdAt: settlementTable.createdAt,
        fromUserEmail: sql<string>`coalesce(${settlementFromUser.email}, '')`,
        fromUserName: sql<string | null>`coalesce(${settlementFromUser.name}, ${settlementFromParticipant.displayName})`,
        fromUserUsername: settlementFromUser.username,
        toUserEmail: sql<string>`coalesce(${settlementToUser.email}, '')`,
        toUserName: sql<string | null>`coalesce(${settlementToUser.name}, ${settlementToParticipant.displayName})`,
        toUserUsername: settlementToUser.username,
      })
      .from(settlementTable)
      .leftJoin(
        settlementFromUser,
        eq(settlementTable.fromUserId, settlementFromUser.id),
      )
      .leftJoin(
        settlementFromParticipant,
        eq(settlementTable.fromParticipantId, settlementFromParticipant.id),
      )
      .leftJoin(
        settlementToUser,
        eq(settlementTable.toUserId, settlementToUser.id),
      )
      .leftJoin(
        settlementToParticipant,
        eq(settlementTable.toParticipantId, settlementToParticipant.id),
      )
      .where(eq(settlementTable.tabId, tabId))
      .orderBy(desc(settlementTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      tabId: r.tabId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      fromParticipantId: r.fromParticipantId,
      toParticipantId: r.toParticipantId,
      amount: Number(r.amount),
      currency: r.currency ?? null,
      originalAmount:
        r.originalAmount != null ? Number(r.originalAmount) : null,
      settlementDate: r.settlementDate,
      createdAt: r.createdAt,
      fromUser: {
        id: r.fromUserId ?? r.fromParticipantId ?? "",
        email: r.fromUserEmail,
        name: r.fromUserName,
        username: r.fromUserUsername,
      },
      toUser: {
        id: r.toUserId ?? r.toParticipantId ?? "",
        email: r.toUserEmail,
        name: r.toUserName,
        username: r.toUserUsername,
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
        fromParticipantId: settlementTable.fromParticipantId,
        toParticipantId: settlementTable.toParticipantId,
        amount: settlementTable.amount,
        currency: settlementTable.currency,
        originalAmount: settlementTable.originalAmount,
        settlementDate: settlementTable.settlementDate,
        createdAt: settlementTable.createdAt,
        fromUserEmail: sql<string>`coalesce(${settlementFromUser.email}, '')`,
        fromUserName: sql<string | null>`coalesce(${settlementFromUser.name}, ${settlementFromParticipant.displayName})`,
        fromUserUsername: settlementFromUser.username,
        toUserEmail: sql<string>`coalesce(${settlementToUser.email}, '')`,
        toUserName: sql<string | null>`coalesce(${settlementToUser.name}, ${settlementToParticipant.displayName})`,
        toUserUsername: settlementToUser.username,
      })
      .from(settlementTable)
      .leftJoin(
        settlementFromUser,
        eq(settlementTable.fromUserId, settlementFromUser.id),
      )
      .leftJoin(
        settlementFromParticipant,
        eq(settlementTable.fromParticipantId, settlementFromParticipant.id),
      )
      .leftJoin(
        settlementToUser,
        eq(settlementTable.toUserId, settlementToUser.id),
      )
      .leftJoin(
        settlementToParticipant,
        eq(settlementTable.toParticipantId, settlementToParticipant.id),
      )
      .where(eq(settlementTable.id, settlementId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      tabId: row.tabId,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      fromParticipantId: row.fromParticipantId,
      toParticipantId: row.toParticipantId,
      amount: Number(row.amount),
      currency: row.currency ?? null,
      originalAmount:
        row.originalAmount != null ? Number(row.originalAmount) : null,
      settlementDate: row.settlementDate,
      createdAt: row.createdAt,
      fromUser: {
        id: row.fromUserId ?? row.fromParticipantId ?? "",
        email: row.fromUserEmail,
        name: row.fromUserName,
        username: row.fromUserUsername,
      },
      toUser: {
        id: row.toUserId ?? row.toParticipantId ?? "",
        email: row.toUserEmail,
        name: row.toUserName,
        username: row.toUserUsername,
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
        fromParticipantId: input.fromParticipantId,
        toParticipantId: input.toParticipantId,
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
    if (prior.fromParticipantId !== input.fromParticipantId) {
      changes.fromParticipantId = {
        from: prior.fromParticipantId,
        to: input.fromParticipantId,
      };
    }
    if (prior.toParticipantId !== input.toParticipantId) {
      changes.toParticipantId = {
        from: prior.toParticipantId,
        to: input.toParticipantId,
      };
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
        fromParticipantId: input.fromParticipantId,
        toParticipantId: input.toParticipantId,
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

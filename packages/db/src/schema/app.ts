import {
  pgTable,
  text,
  timestamp,
  date,
  decimal,
  boolean,
  integer,
  primaryKey,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "shared";
import { user } from "./auth.js";

export const friendRequest = pgTable("friend_request", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  fromUserId: text("fromUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("toUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const pendingFriend = pgTable("pending_friend", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  token: text("token").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tab = pgTable("tab", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  isDirect: boolean("isDirect").notNull().default(false),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tabMember = pgTable(
  "tab_member",
  {
    tabId: text("tabId")
      .notNull()
      .references(() => tab.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.tabId, t.userId] })],
);

/** Recurring expense template and schedule (cron posts expenses from template). */
export const recurringExpenseRule = pgTable(
  "recurring_expense_rule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    tabId: text("tabId")
      .notNull()
      .references(() => tab.id, { onDelete: "cascade" }),
    ownerUserId: text("ownerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** active | paused_user | paused_needs_fix */
    status: text("status").notNull().default("active"),
    /** Discriminated schedule JSON (interval_days | monthly_nth | weekly). */
    schedule: jsonb("schedule").notNull(),
    /** Frozen expense fields: amount, currency, description, paidById, splitType, splits?, participantIds?. */
    template: jsonb("template").notNull(),
    startsOn: date("startsOn", { mode: "string" }).notNull(),
    endsOn: date("endsOn", { mode: "string" }),
    maxCount: integer("maxCount"),
    postedCount: integer("postedCount").notNull().default(0),
    /** Next calendar date (YYYY-MM-DD in owner TZ) when a post may run. */
    nextDueKey: text("nextDueKey").notNull(),
    pausedAt: timestamp("pausedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("recurring_expense_rule_tabId_idx").on(t.tabId),
    index("recurring_expense_rule_ownerUserId_idx").on(t.ownerUserId),
    index("recurring_expense_rule_status_nextDueKey_idx").on(t.status, t.nextDueKey),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    tabId: text("tabId")
      .notNull()
      .references(() => tab.id, { onDelete: "cascade" }),
    paidById: text("paidById")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recurringRuleId: text("recurringRuleId").references(() => recurringExpenseRule.id, {
      onDelete: "set null",
    }),
    /** Tab-currency total (ledger / splits). */
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    /** ISO currency code for the amount the user entered. */
    currency: text("currency").notNull().default("USD"),
    /** Amount in `currency` (user input). */
    originalAmount: decimal("originalAmount", { precision: 12, scale: 2 }).notNull(),
    description: text("description").notNull(),
    splitType: text("splitType").notNull().default("equal"),
    expenseDate: timestamp("expenseDate").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [
    index("expense_tabId_expenseDate_idx").on(t.tabId, t.expenseDate),
    index("expense_tabId_deletedAt_idx").on(t.tabId, t.deletedAt),
    index("expense_recurringRuleId_idx").on(t.recurringRuleId),
  ],
);

/** One row per posted occurrence; unique (ruleId, occurrenceKey) for idempotency. */
export const recurringExpenseOccurrence = pgTable(
  "recurring_expense_occurrence",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ruleId: text("ruleId")
      .notNull()
      .references(() => recurringExpenseRule.id, { onDelete: "cascade" }),
    occurrenceKey: text("occurrenceKey").notNull(),
    expenseId: text("expenseId").references(() => expense.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("recurring_expense_occurrence_ruleId_occurrenceKey_uidx").on(
      t.ruleId,
      t.occurrenceKey,
    ),
  ],
);

/** Cached Frankfurter rate snapshots (ECB date + base). */
export const fxRateSnapshot = pgTable(
  "fx_rate_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    rateDate: date("rateDate", { mode: "string" }).notNull(),
    base: text("base").notNull(),
    rates: jsonb("rates").notNull().$type<Record<string, number>>(),
    fetchedAt: timestamp("fetchedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("fx_rate_snapshot_rateDate_base_idx").on(t.rateDate, t.base),
  ],
);

export const expenseReaction = pgTable(
  "expense_reaction",
  {
    expenseId: text("expenseId")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
);

export const expenseSplit = pgTable("expense_split", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  expenseId: text("expenseId")
    .notNull()
    .references(() => expense.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  /** Percent or share count for splitType percent/shares; null for equal/custom. */
  weight: decimal("weight", { precision: 10, scale: 6 }),
});

export const pendingTabInvite = pgTable("pending_tab_invite", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  token: text("token").notNull().unique(),
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  createdByUserId: text("createdByUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tabInviteRequest = pgTable("tab_invite_request", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  fromUserId: text("fromUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("toUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const settlement = pgTable("settlement", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  fromUserId: text("fromUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("toUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  /** When set, payment was entered in this currency; `originalAmount` is the entered total. */
  currency: text("currency"),
  originalAmount: decimal("originalAmount", { precision: 12, scale: 2 }),
  /** Calendar date of the payment (used for ordering and FX). */
  settlementDate: timestamp("settlementDate").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const expenseAuditLog = pgTable("expense_audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  expenseId: text("expenseId").notNull(), // No FK - audit persists after expense delete
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // create | update | delete
  performedById: text("performedById")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  performedAt: timestamp("performedAt").notNull().defaultNow(),
  changes: jsonb("changes"), // for updates: { amount: { from, to }, description: { from, to }, ... }
});

export const settlementAuditLog = pgTable("settlement_audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  settlementId: text("settlementId")
    .notNull()
    .references(() => settlement.id, { onDelete: "cascade" }),
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  action: text("action").notNull().default("create"),
  performedById: text("performedById")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  performedAt: timestamp("performedAt").notNull().defaultNow(),
  changes: jsonb("changes"),
});

export const apiKey = pgTable("api_key", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  keyHash: text("keyHash").notNull(),
  keyPrefix: text("keyPrefix").notNull(),
  name: text("name").notNull(),
  scopes: text("scopes"), // comma-separated, e.g. "read,write"
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  expiresAt: timestamp("expiresAt"),
});

export const pushSubscription = pgTable("push_subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const userPreference = pgTable(
  "user_preference",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

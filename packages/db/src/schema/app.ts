import {
  pgTable,
  text,
  timestamp,
  decimal,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const friendRequest = pgTable("friend_request", {
  id: text("id").primaryKey(),
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
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tab = pgTable("tab", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isDirect: boolean("isDirect").notNull().default(false),
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
  (t) => [primaryKey({ columns: [t.tabId, t.userId] })]
);

export const expense = pgTable("expense", {
  id: text("id").primaryKey(),
  tabId: text("tabId")
    .notNull()
    .references(() => tab.id, { onDelete: "cascade" }),
  paidById: text("paidById")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  splitType: text("splitType").notNull().default("equal"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const expenseSplit = pgTable("expense_split", {
  id: text("id").primaryKey(),
  expenseId: text("expenseId")
    .notNull()
    .references(() => expense.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
});

export const pendingTabInvite = pgTable("pending_tab_invite", {
  id: text("id").primaryKey(),
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
  id: text("id").primaryKey(),
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
  id: text("id").primaryKey(),
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
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

import {
  pgTable,
  text,
  timestamp,
  decimal,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const group = pgTable("group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const groupMember = pgTable(
  "group_member",
  {
    groupId: text("groupId")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })]
);

export const expense = pgTable("expense", {
  id: text("id").primaryKey(),
  groupId: text("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
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

export const settlement = pgTable("settlement", {
  id: text("id").primaryKey(),
  groupId: text("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  fromUserId: text("fromUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("toUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

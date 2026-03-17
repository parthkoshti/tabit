import { Hono } from "hono";
import { db, userPreference } from "db";
import { and, eq } from "drizzle-orm";
import {
  isAddExpensePreference,
  type AddExpensePreference,
} from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";

const ADD_EXPENSE_PREFERENCE_KEY = "add_expense_preference";

export const preferencesRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

preferencesRoutes.use("*", authMiddleware);

preferencesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");

  const rows = await db
    .select()
    .from(userPreference)
    .where(eq(userPreference.userId, userId));

  const prefs: { addExpensePreference?: AddExpensePreference } = {};
  for (const row of rows) {
    if (
      row.key === ADD_EXPENSE_PREFERENCE_KEY &&
      isAddExpensePreference(row.value)
    ) {
      prefs.addExpensePreference = row.value;
    }
  }

  return c.json({ success: true, ...prefs });
});

preferencesRoutes.patch("/", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));

  if ("addExpensePreference" in body) {
    const val = body.addExpensePreference;
    const value: AddExpensePreference | null =
      val === null || val === undefined
        ? null
        : isAddExpensePreference(val)
          ? val
          : null;

    if (value !== null) {
      await db
        .insert(userPreference)
        .values({
          userId,
          key: ADD_EXPENSE_PREFERENCE_KEY,
          value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userPreference.userId, userPreference.key],
          set: { value, updatedAt: new Date() },
        });
    } else if (val === null || val === undefined) {
      await db
        .delete(userPreference)
        .where(
          and(
            eq(userPreference.userId, userId),
            eq(userPreference.key, ADD_EXPENSE_PREFERENCE_KEY),
          ),
        );
    }
  }

  return c.json({ success: true });
});

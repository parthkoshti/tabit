import { CURRENCY_CODES } from "shared";
import { user as userData, preference as preferenceData } from "data";
import {
  isAddExpensePreference,
  type AddExpensePreference,
} from "models";
import { ok, err, type Result } from "./types.js";

const NAME_MAX_LENGTH = 64;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,12}$/;
const ADD_EXPENSE_PREFERENCE_KEY = "add_expense_preference";

export const userService = {
  updateProfile: async (
    userId: string,
    updates: { name?: string | null; defaultCurrency?: string | null },
  ): Promise<Result<void>> => {
    const resolved: { name?: string | null; defaultCurrency?: string | null } = {};

    if ("name" in updates) {
      const name =
        updates.name === null || updates.name === undefined
          ? null
          : typeof updates.name === "string"
            ? updates.name.trim() || null
            : null;
      if (name !== null && name.length > NAME_MAX_LENGTH) {
        return err(`Name must be at most ${NAME_MAX_LENGTH} characters`, 400);
      }
      resolved.name = name;
    }

    if ("defaultCurrency" in updates) {
      const defaultCurrency =
        updates.defaultCurrency === null || updates.defaultCurrency === undefined
          ? null
          : typeof updates.defaultCurrency === "string"
            ? updates.defaultCurrency.trim() || null
            : null;
      if (
        defaultCurrency !== null &&
        !(CURRENCY_CODES as readonly string[]).includes(defaultCurrency)
      ) {
        return err("Invalid currency code", 400);
      }
      resolved.defaultCurrency = defaultCurrency;
    }

    if (Object.keys(resolved).length === 0) {
      return ok(undefined);
    }

    await userData.updateProfile(userId, resolved);
    return ok(undefined);
  },

  checkUsernameAvailable: async (
    userId: string,
    username: string,
  ): Promise<Result<boolean>> => {
    const trimmed = username.trim();
    if (!trimmed) return ok(false);
    if (trimmed.length < 5) return ok(false);
    if (trimmed.length > 12) return ok(false);
    if (!USERNAME_REGEX.test(trimmed)) return ok(false);

    const normalized = trimmed.toLowerCase();
    const currentUsername = await userData.getUsername(userId);
    if (normalized === (currentUsername?.toLowerCase() ?? null)) {
      return ok(true);
    }

    const existingId = await userData.getByUsernameForId(normalized);
    return ok(!existingId);
  },

  updateUsername: async (
    userId: string,
    username: string,
  ): Promise<Result<void>> => {
    const trimmed = username.trim();
    if (!trimmed) {
      return err("Username is required", 400);
    }
    if (trimmed.length < 5) {
      return err("Username must be at least 5 characters", 400);
    }
    if (trimmed.length > 12) {
      return err("Username must be at most 12 characters", 400);
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      return err("Username can only contain letters, numbers, and underscores", 400);
    }

    const normalized = trimmed.toLowerCase();
    const existingId = await userData.getByUsernameForId(normalized);
    if (existingId && existingId !== userId) {
      return err("Username is already taken", 400);
    }

    await userData.updateUsername(userId, normalized);
    return ok(undefined);
  },

  getPreferences: async (userId: string) => {
    const rows = await preferenceData.getByUserId(userId);
    const prefs: { addExpensePreference?: AddExpensePreference } = {};
    for (const row of rows) {
      if (
        row.key === ADD_EXPENSE_PREFERENCE_KEY &&
        isAddExpensePreference(row.value)
      ) {
        prefs.addExpensePreference = row.value;
      }
    }
    return ok(prefs);
  },

  updatePreferences: async (
    userId: string,
    updates: { addExpensePreference?: AddExpensePreference | null },
  ): Promise<Result<void>> => {
    if ("addExpensePreference" in updates) {
      const val = updates.addExpensePreference;
      const value: AddExpensePreference | null =
        val === null || val === undefined
          ? null
          : isAddExpensePreference(val)
            ? val
            : null;

      if (value !== null) {
        await preferenceData.upsert(
          userId,
          ADD_EXPENSE_PREFERENCE_KEY,
          value,
        );
      } else if (val === null || val === undefined) {
        await preferenceData.delete(userId, ADD_EXPENSE_PREFERENCE_KEY);
      }
    }
    return ok(undefined);
  },
};

export const ADD_EXPENSE_PREFERENCE_VALUES = ["ai", "manual"] as const;
export type AddExpensePreference = (typeof ADD_EXPENSE_PREFERENCE_VALUES)[number];

export function isAddExpensePreference(
  val: unknown,
): val is AddExpensePreference {
  return val === "ai" || val === "manual";
}

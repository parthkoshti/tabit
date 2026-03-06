export const queryKeys = {
  groups: ["groups"] as const,
  group: (id: string) => ["groups", id] as const,
  expenses: (groupId: string) => ["groups", groupId, "expenses"] as const,
  balances: (groupId: string) => ["groups", groupId, "balances"] as const,
};

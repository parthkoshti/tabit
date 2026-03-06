export const queryKeys = {
  tabs: ["tabs"] as const,
  tab: (id: string) => ["tab", id] as const,
  expenses: (tabId: string) => ["expenses", tabId] as const,
  balances: (tabId: string) => ["balances", tabId] as const,
};

export { expense } from "./expense.js";
export type {
  CreateExpenseInput,
  UpdateExpenseInput,
  GetExpensesForTabOptions,
  GetExpensesForTabResult,
  Expense,
  ExpenseAuditLogEntry,
} from "./expense.js";

export { tab } from "./tab.js";
export type { TabWithBalance, TabWithMembers, FriendTab, Balance } from "./tab.js";

export { settlement } from "./settlement.js";
export type {
  RecordSettlementInput,
  UpdateSettlementInput,
  Settlement,
  SettlementAuditLogEntry,
} from "./settlement.js";

export { activity } from "./activity.js";
export type {
  ActivityItem,
  GetActivityForUserOptions,
  GetActivityForUserResult,
} from "./activity.js";

// Backward compatibility - re-export as flat functions
import { expense } from "./expense.js";
import { tab } from "./tab.js";
import { settlement } from "./settlement.js";
import { activity } from "./activity.js";

export const getBalancesForTab = tab.getBalancesForTab;
export const getTabsForUser = tab.getTabsForUser;
export const getDirectTabsForUser = tab.getDirectTabsForUser;
export const getTabWithMembers = tab.getWithMembers;

export const getExpensesForTab = expense.getForTab;
export const getExpenseById = expense.getById;
export const getExpenseAuditLog = expense.getAuditLog;

export const getSettlementsForTab = settlement.getForTab;
export const getSettlementById = settlement.getById;
export const getSettlementAuditLog = settlement.getAuditLog;

export const getActivityForUser = activity.getForUser;

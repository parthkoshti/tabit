export { fxRate } from "./fx-rate.js";

export { expense } from "./expense.js";
export type {
  CreateExpenseInput,
  UpdateExpenseInput,
  GetExpensesForTabOptions,
  GetExpensesForTabResult,
  Expense,
  ExpenseAuditLogEntry,
  ExpenseFilter,
  ExpenseReaction,
} from "./expense.js";

export { tab } from "./tab.js";
export type {
  TabWithBalance,
  TabWithMembers,
  FriendTab,
  Balance,
  SharedGroupTabListItem,
} from "./tab.js";

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
  ActivityDirectOtherUser,
  GetActivityForUserOptions,
  GetActivityForUserResult,
} from "./activity.js";

export { user } from "./user.js";
export type { User } from "./user.js";

export { friend } from "./friend.js";
export type { FriendRequest, PendingFriend } from "./friend.js";

export { preference } from "./preference.js";

export { apiKeyData } from "./api-key.js";
export type { ApiKeySummary, ApiKeyCreated } from "./api-key.js";

export { push } from "./push.js";
export { tabInvite } from "./tab-invite.js";
export type {
  PendingTabInviteByToken,
  TabInviteRequestRow,
  TabInviteRequestWithDetails,
} from "./tab-invite.js";

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

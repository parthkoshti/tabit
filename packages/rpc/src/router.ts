import { friendsProcedures } from "./procedures/friends.js";
import { tabInvitesProcedures } from "./procedures/tab-invites.js";
import { tabsProcedures } from "./procedures/tabs.js";
import { expensesProcedures } from "./procedures/expenses.js";
import { recurringExpensesProcedures } from "./procedures/recurring-expenses.js";
import { activityProcedures } from "./procedures/activity.js";
import { profileProcedures } from "./procedures/profile.js";
import { preferencesProcedures } from "./procedures/preferences.js";
import { usernameProcedures } from "./procedures/username.js";
import { pushProcedures } from "./procedures/push.js";
import { notificationsProcedures } from "./procedures/notifications.js";
import { aiProcedures } from "./procedures/ai.js";

export const appRouter = {
  friends: friendsProcedures,
  tabInvites: tabInvitesProcedures,
  tabs: tabsProcedures,
  expenses: expensesProcedures,
  recurringExpenses: recurringExpensesProcedures,
  activity: activityProcedures,
  profile: profileProcedures,
  preferences: preferencesProcedures,
  username: usernameProcedures,
  push: pushProcedures,
  notifications: notificationsProcedures,
  ai: aiProcedures,
};

export type AppRouter = typeof appRouter;

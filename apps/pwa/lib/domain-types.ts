/** Client-side shapes for API responses (no `data` package in the browser bundle). */

export type ExpenseReaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

export type Expense = {
  id: string;
  tabId: string;
  paidById: string | null;
  paidByParticipantId: string | null;
  recurringRuleId?: string | null;
  amount: number;
  currency: string;
  originalAmount: number;
  description: string;
  splitType: string;
  expenseDate: Date | string;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  paidBy: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  splits: Array<{
    id: string;
    expenseId: string;
    userId: string | null;
    participantId: string | null;
    amount: number;
    weight: number | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      username?: string | null;
    };
  }>;
  reactions: ExpenseReaction[];
};

export type Settlement = {
  id: string;
  tabId: string;
  fromUserId: string | null;
  toUserId: string | null;
  fromParticipantId: string | null;
  toParticipantId: string | null;
  amount: number;
  currency: string | null;
  originalAmount: number | null;
  settlementDate: Date | string;
  createdAt: Date | string;
  fromUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
  toUser: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export type Balance = {
  participantId: string;
  userId: string | null;
  kind: string;
  displayName: string;
  amount: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

export type ActivityDirectOtherUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
};

export type ActivityItem =
  | {
      type: "expense";
      id: string;
      tabId: string;
      tabName: string;
      tabCurrency: string;
      tabIsDirect: boolean;
      directOtherUser: ActivityDirectOtherUser | null;
      paidById: string | null;
      paidByParticipantId: string | null;
      paidByEmail: string;
      paidByName: string | null;
      paidByUsername: string | null;
      amount: number;
      expenseCurrency: string;
      originalAmount: number;
      yourShare: number | null;
      description: string;
      expenseDate: Date | string;
      createdAt: Date | string;
      deletedAt: Date | string | null;
    }
  | {
      type: "settlement";
      id: string;
      tabId: string;
      tabName: string;
      tabCurrency: string;
      tabIsDirect: boolean;
      directOtherUser: ActivityDirectOtherUser | null;
      fromUserId: string | null;
      fromUserEmail: string;
      fromUserName: string | null;
      fromUserUsername: string | null;
      toUserId: string | null;
      toUserEmail: string;
      toUserName: string | null;
      toUserUsername: string | null;
      amount: number;
      settlementCurrency: string | null;
      originalAmount: number | null;
      settlementDate: Date | string;
      createdAt: Date | string;
    }
  | {
      type: "placeholder_merge";
      id: string;
      tabId: string;
      tabName: string;
      tabCurrency: string;
      tabIsDirect: boolean;
      directOtherUser: ActivityDirectOtherUser | null;
      performedByUserId: string;
      performedByEmail: string;
      performedByName: string | null;
      performedByUsername: string | null;
      placeholderDisplayName: string;
      targetDisplayName: string;
      createdAt: Date | string;
    };

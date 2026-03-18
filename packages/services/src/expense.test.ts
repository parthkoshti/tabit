import { describe, test, expect, vi, beforeEach } from "vitest";
import { expenseService } from "./expense.js";
import { expense, tab, user as userData } from "data";
import { notificationService } from "./notification.js";

const baseCreateInput = {
  tabId: "tab1",
  paidById: "user1",
  amount: 100,
  description: "Test",
  splitType: "equal" as const,
  expenseDate: new Date(),
};

const baseMembers = [
  { userId: "user1", role: "member" },
  { userId: "user2", role: "member" },
];

describe("expenseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getForTab", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.getForTab("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns expenses if user is a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getForTab).mockResolvedValue({
        expenses: [
          {
            id: "exp1",
            tabId: "tab1",
            paidById: "user1",
            amount: 100,
            description: "Test",
            splitType: "equal",
            expenseDate: new Date(),
            createdAt: new Date(),
            deletedAt: null,
            paidBy: { id: "user1" },
            splits: [],
            reactions: [],
          },
        ],
        total: 1,
      });

      const result = await expenseService.getForTab("tab1", "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenses).toHaveLength(1);
        expect(result.data.total).toBe(1);
      }
    });
  });

  describe("getById", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.getById("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense not found", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue(null);

      const result = await expenseService.getById("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense not found");
        expect(result.status).toBe(404);
      }
    });
  });

  describe("create", () => {
    test("returns error if performer is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.create(baseCreateInput, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
        expect(result.status).toBe(403);
      }
    });

    test("validates payer is a member", async () => {
      vi.mocked(tab.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vi.mocked(tab.getMembers).mockResolvedValue(baseMembers);

      const result = await expenseService.create(baseCreateInput, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Payer must be a member");
      }
    });

    test("validates at least one participant", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue([]);

      const result = await expenseService.create(
        { ...baseCreateInput, participantIds: [] },
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("At least one person must be in the split");
      }
    });

    test("validates payer cannot be only participant", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue([{ userId: "user1", role: "member" }]);

      const result = await expenseService.create(baseCreateInput, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Payer cannot be the only member of the split");
      }
    });

    test("validates custom split requires splits array", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue(baseMembers);

      const result = await expenseService.create(
        { ...baseCreateInput, splitType: "custom" },
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Custom split requires splits array");
      }
    });

    test("success path: equal split with 2 people", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue(baseMembers);
      vi.mocked(tab.getTabInfoForNotifications).mockResolvedValue({
        name: "Test Tab",
        isDirect: false,
        currency: "USD",
        displayName: "Test Tab",
      });
      vi.mocked(userData.getById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(userData.getByIds).mockResolvedValue([
        { id: "user1", name: "User 1", username: "user1" },
        { id: "user2", name: "User 2", username: "user2" },
      ]);
      vi.mocked(expense.create).mockResolvedValue("exp1");

      const result = await expenseService.create(baseCreateInput, "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseId).toBe("exp1");
      }
      expect(expense.create).toHaveBeenCalled();
      const createCall = vi.mocked(expense.create).mock.calls[0][0];
      expect(createCall.splits).toHaveLength(2);
      expect(createCall.splits?.reduce((a, s) => a + s.amount, 0)).toBe(100);
    });

    test("success path: equal split with 3 people", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue([
        ...baseMembers,
        { userId: "user3", role: "member" },
      ]);
      vi.mocked(tab.getTabInfoForNotifications).mockResolvedValue({
        name: "Test Tab",
        isDirect: false,
        currency: "USD",
        displayName: "Test Tab",
      });
      vi.mocked(userData.getById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(userData.getByIds).mockResolvedValue([
        { id: "user1", name: "User 1", username: "user1" },
        { id: "user2", name: "User 2", username: "user2" },
        { id: "user3", name: "User 3", username: "user3" },
      ]);
      vi.mocked(expense.create).mockResolvedValue("exp1");

      const result = await expenseService.create(
        { ...baseCreateInput, amount: 10 },
        "user1",
      );

      expect(result.success).toBe(true);
      const createCall = vi.mocked(expense.create).mock.calls[0][0];
      expect(createCall.splits).toHaveLength(3);
      expect(createCall.splits?.reduce((a, s) => a + s.amount, 0)).toBe(10);
    });

    test("success path: custom split", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getMembers).mockResolvedValue(baseMembers);
      vi.mocked(tab.getTabInfoForNotifications).mockResolvedValue({
        name: "Test Tab",
        isDirect: false,
        currency: "USD",
        displayName: "Test Tab",
      });
      vi.mocked(userData.getById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(userData.getByIds).mockResolvedValue([
        { id: "user1", name: "User 1", username: "user1" },
        { id: "user2", name: "User 2", username: "user2" },
      ]);
      vi.mocked(expense.create).mockResolvedValue("exp1");

      const result = await expenseService.create(
        {
          ...baseCreateInput,
          splitType: "custom",
          splits: [
            { userId: "user1", amount: 60 },
            { userId: "user2", amount: 40 },
          ],
        },
        "user1",
      );

      expect(result.success).toBe(true);
      const createCall = vi.mocked(expense.create).mock.calls[0][0];
      expect(createCall.splits).toEqual([
        { userId: "user1", amount: 60 },
        { userId: "user2", amount: 40 },
      ]);
    });
  });

  describe("update", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(expense.getById).mockResolvedValue({
        id: "exp1",
        tabId: "tab1",
        paidById: "user1",
        amount: 100,
        description: "Test",
        splitType: "equal",
        expenseDate: new Date(),
        createdAt: new Date(),
        deletedAt: null,
        paidBy: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        paidByEmail: "u1@test.com",
        paidByName: "User 1",
        paidByUsername: "user1",
        splits: [{ id: "s1", expenseId: "exp1", userId: "user2", amount: 50, user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
        reactions: [],
      });
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.update(
        "tab1",
        "exp1",
        baseCreateInput,
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense not found", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue(null);

      const result = await expenseService.update(
        "tab1",
        "exp1",
        baseCreateInput,
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense not found");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if editing deleted expense", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue({
        id: "exp1",
        tabId: "tab1",
        paidById: "user1",
        amount: 100,
        description: "Test",
        splitType: "equal",
        expenseDate: new Date(),
        createdAt: new Date(),
        deletedAt: new Date(),
        paidBy: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        paidByEmail: "u1@test.com",
        paidByName: "User 1",
        paidByUsername: "user1",
        splits: [{ id: "s1", expenseId: "exp1", userId: "user2", amount: 50, user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
        reactions: [],
      });

      const result = await expenseService.update(
        "tab1",
        "exp1",
        baseCreateInput,
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Cannot edit a deleted expense");
      }
    });
  });

  describe("delete", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(expense.getById).mockResolvedValue({
        id: "exp1",
        tabId: "tab1",
        paidById: "user1",
        amount: 100,
        description: "Test",
        splitType: "equal",
        expenseDate: new Date(),
        createdAt: new Date(),
        deletedAt: null,
        paidBy: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        paidByEmail: "u1@test.com",
        paidByName: "User 1",
        paidByUsername: "user1",
        splits: [],
        reactions: [],
      });
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.delete("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense already deleted", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue({
        id: "exp1",
        tabId: "tab1",
        paidById: "user1",
        amount: 100,
        description: "Test",
        splitType: "equal",
        expenseDate: new Date(),
        createdAt: new Date(),
        deletedAt: new Date(),
        paidBy: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        paidByEmail: "u1@test.com",
        paidByName: "User 1",
        paidByUsername: "user1",
        splits: [],
        reactions: [],
      });

      const result = await expenseService.delete("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense already deleted");
      }
    });
  });

  describe("restore", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.restore("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense not deleted", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue({
        id: "exp1",
        tabId: "tab1",
        paidById: "user1",
        amount: 100,
        description: "Test",
        splitType: "equal",
        expenseDate: new Date(),
        createdAt: new Date(),
        deletedAt: null,
        paidBy: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        paidByEmail: "u1@test.com",
        paidByName: "User 1",
        paidByUsername: "user1",
        splits: [],
        reactions: [],
      });

      const result = await expenseService.restore("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense is not deleted");
      }
    });
  });

  describe("createBulk", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.createBulk(
        "tab1",
        [{ amount: 100, description: "Test", splitType: "equal", expenseDate: new Date(),
          participantIds: ["user1", "user2"] }],
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if no expenses to import", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await expenseService.createBulk("tab1", [], "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No expenses to import");
      }
    });
  });

  describe("addReaction", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.addReaction("tab1", "exp1", "thumbsup", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense not found", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue(null);

      const result = await expenseService.addReaction("tab1", "exp1", "thumbsup", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense not found");
      }
    });

    test("returns error if emoji invalid", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await expenseService.addReaction("tab1", "exp1", "", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid emoji");
      }
    });
  });

  describe("removeReaction", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await expenseService.removeReaction("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if expense not found", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(expense.getById).mockResolvedValue(null);

      const result = await expenseService.removeReaction("tab1", "exp1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Expense not found");
      }
    });
  });
});

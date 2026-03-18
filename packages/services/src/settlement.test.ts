import { describe, test, expect, vi, beforeEach } from "vitest";
import { settlementService } from "./settlement.js";
import { tab, settlement } from "data";

const tabWithMembers = {
  id: "tab1",
  name: "Test Tab",
  currency: "USD",
  isDirect: false,
  createdAt: new Date(),
  members: [
    { userId: "user1", role: "member", user: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" } },
    { userId: "user2", role: "member", user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } },
  ],
};

describe("settlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getForTab", () => {
    test("returns error if tab not found", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue(null);

      const result = await settlementService.getForTab("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tab not found");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if user is not a member", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        ...tabWithMembers,
        members: [{ userId: "user2", role: "member", user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
      });

      const result = await settlementService.getForTab("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns settlements if user is a member", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue(tabWithMembers);
      vi.mocked(settlement.getForTab).mockResolvedValue([]);

      const result = await settlementService.getForTab("tab1", "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe("getById", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        ...tabWithMembers,
        members: [{ userId: "user2", role: "member", user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
      });

      const result = await settlementService.getById("tab1", "set1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
      }
    });

    test("returns error if settlement not found", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue(tabWithMembers);
      vi.mocked(settlement.getById).mockResolvedValue(null);

      const result = await settlementService.getById("tab1", "set1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Settlement not found");
      }
    });
  });

  describe("record", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await settlementService.record("tab1", "user1", "user2", 50, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if fromUser not a member", async () => {
      vi.mocked(tab.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await settlementService.record("tab1", "user3", "user2", 50, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Both payer and payee must be tab members");
      }
    });

    test("returns error if toUser not a member", async () => {
      vi.mocked(tab.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await settlementService.record("tab1", "user1", "user3", 50, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Both payer and payee must be tab members");
      }
    });

    test("returns error if same user", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await settlementService.record("tab1", "user1", "user1", 50, "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Payer and payee must be different people");
      }
    });

    test("success path: record settlement", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await settlementService.record("tab1", "user1", "user2", 50, "user1");

      expect(result.success).toBe(true);
      expect(settlement.record).toHaveBeenCalledWith({
        tabId: "tab1",
        fromUserId: "user1",
        toUserId: "user2",
        amount: 50,
        performedById: "user1",
      });
    });
  });

  describe("update", () => {
    test("returns error if settlement not found", async () => {
      vi.mocked(settlement.getById).mockResolvedValue(null);

      const result = await settlementService.update(
        "tab1",
        "set1",
        "user1",
        "user2",
        50,
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Settlement not found");
      }
    });

    test("returns error if user is not a member", async () => {
      vi.mocked(settlement.getById).mockResolvedValue({
        id: "set1",
        tabId: "tab1",
        fromUserId: "user1",
        toUserId: "user2",
        amount: 50,
        createdAt: new Date(),
        fromUser: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        toUser: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" },
      });
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await settlementService.update(
        "tab1",
        "set1",
        "user1",
        "user2",
        60,
        "user1",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
      }
    });

    test("success path: update settlement", async () => {
      vi.mocked(settlement.getById).mockResolvedValue({
        id: "set1",
        tabId: "tab1",
        fromUserId: "user1",
        toUserId: "user2",
        amount: 50,
        createdAt: new Date(),
        fromUser: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        toUser: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" },
      });
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await settlementService.update(
        "tab1",
        "set1",
        "user1",
        "user2",
        60,
        "user1",
      );

      expect(result.success).toBe(true);
      expect(settlement.update).toHaveBeenCalledWith("set1", "tab1", {
        fromUserId: "user1",
        toUserId: "user2",
        amount: 60,
        performedById: "user1",
      });
    });
  });

  describe("delete", () => {
    test("returns error if settlement not found", async () => {
      vi.mocked(settlement.getById).mockResolvedValue(null);

      const result = await settlementService.delete("tab1", "set1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Settlement not found");
      }
    });

    test("returns error if user is not a member", async () => {
      vi.mocked(settlement.getById).mockResolvedValue({
        id: "set1",
        tabId: "tab1",
        fromUserId: "user1",
        toUserId: "user2",
        amount: 50,
        createdAt: new Date(),
        fromUser: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" },
        toUser: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" },
      });
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await settlementService.delete("tab1", "set1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
      }
    });
  });
});

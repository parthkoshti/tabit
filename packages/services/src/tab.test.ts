import { describe, test, expect, vi, beforeEach } from "vitest";
import { tabService } from "./tab.js";
import { tab, user } from "data";

describe("tabService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWithMembers", () => {
    test("returns error if tab not found", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue(null);

      const result = await tabService.getWithMembers("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tab not found");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if user is not a member", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        isDirect: false,
        createdAt: new Date(),
        members: [{ userId: "user2", role: "member", user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
      });

      const result = await tabService.getWithMembers("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
        expect(result.status).toBe(403);
      }
    });

    test("returns tab if user is a member", async () => {
      const tabData = {
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        isDirect: false,
        createdAt: new Date(),
        members: [{ userId: "user1", role: "member", user: { id: "user1", email: "u1@test.com", name: "User 1", username: "user1" } }],
      };
      vi.mocked(tab.getWithMembers).mockResolvedValue(tabData);

      const result = await tabService.getWithMembers("tab1", "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(tabData);
      }
    });
  });

  describe("getBalancesForTab", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        isDirect: false,
        createdAt: new Date(),
        members: [{ userId: "user2", role: "member", user: { id: "user2", email: "u2@test.com", name: "User 2", username: "user2" } }],
      });

      const result = await tabService.getBalancesForTab("tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member");
      }
    });
  });

  describe("create", () => {
    test("validates currency code", async () => {
      const result = await tabService.create("Test Tab", "user1", "INVALID");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid currency code");
        expect(result.status).toBe(400);
      }
    });

    test("creates tab with default currency from user", async () => {
      vi.mocked(user.getDefaultCurrency).mockResolvedValue("EUR");
      vi.mocked(tab.create).mockResolvedValue("tab1");

      const result = await tabService.create("Test Tab", "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tabId).toBe("tab1");
      }
      expect(tab.create).toHaveBeenCalledWith("Test Tab", "user1", "EUR");
    });

    test("creates tab with explicit currency", async () => {
      vi.mocked(tab.create).mockResolvedValue("tab1");

      const result = await tabService.create("Test Tab", "user1", "GBP");

      expect(result.success).toBe(true);
      expect(tab.create).toHaveBeenCalledWith("Test Tab", "user1", "GBP");
    });
  });

  describe("update", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await tabService.update("tab1", "user1", { name: "New Name" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if no fields provided", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await tabService.update("tab1", "user1", {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Provide name or currency to update");
      }
    });

    test("returns error if direct tab rename", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        id: "tab1",
        name: "Direct",
        currency: "USD",
        createdAt: new Date(),
        isDirect: true,
        members: [],
      });

      const result = await tabService.update("tab1", "user1", { name: "New Name" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Direct tabs cannot be renamed");
      }
    });

    test("returns error if invalid currency", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        isDirect: false,
        createdAt: new Date(),
        members: [],
      });

      const result = await tabService.update("tab1", "user1", { currency: "INVALID" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid currency code");
      }
    });

    test("success path: update name", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(tab.getWithMembers).mockResolvedValue({
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        isDirect: false,
        createdAt: new Date(),
        members: [],
      });

      const result = await tabService.update("tab1", "user1", { name: "New Name" });

      expect(result.success).toBe(true);
      expect(tab.update).toHaveBeenCalledWith("tab1", { name: "New Name" });
    });
  });

  describe("addMember", () => {
    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await tabService.addMember("tab1", "user1", "new@test.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
      }
    });

    test("returns error if user not found by email", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(user.getByEmail).mockResolvedValue(null);

      const result = await tabService.addMember("tab1", "user1", "nonexistent@test.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User not found with that email");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if already a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(user.getByEmail).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "user2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(tab.getMembers).mockResolvedValue([
        { userId: "user1", role: "owner" },
        { userId: "user2", role: "member" },
      ]);

      const result = await tabService.addMember("tab1", "user1", "user2@test.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User is already a member");
      }
    });

    test("success path: add member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);
      vi.mocked(user.getByEmail).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "user2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(tab.getMembers).mockResolvedValue([{ userId: "user1", role: "owner" }]);

      const result = await tabService.addMember("tab1", "user1", "user2@test.com");

      expect(result.success).toBe(true);
      expect(tab.addMember).toHaveBeenCalledWith("tab1", "user2", "member");
    });
  });

  describe("removeMember", () => {
    test("returns error if removing self", async () => {
      const result = await tabService.removeMember("tab1", "user1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Use leave to remove yourself");
      }
    });

    test("returns error if user is not a member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(false);

      const result = await tabService.removeMember("tab1", "user1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
      }
    });

    test("returns error if target not a member", async () => {
      vi.mocked(tab.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await tabService.removeMember("tab1", "user1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User is not a member of this tab");
      }
    });

    test("success path: remove member", async () => {
      vi.mocked(tab.isMember).mockResolvedValue(true);

      const result = await tabService.removeMember("tab1", "user1", "user2");

      expect(result.success).toBe(true);
      expect(tab.removeMember).toHaveBeenCalledWith("tab1", "user2");
    });
  });
});

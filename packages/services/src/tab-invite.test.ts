import { describe, test, expect, vi, beforeEach } from "vitest";
import { tabInviteService } from "./tab-invite.js";
import { tabInvite as tabInviteData, user } from "data";
import { notificationService } from "./notification.js";

describe("tabInviteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getByToken", () => {
    test("returns error if token invalid or expired", async () => {
      vi.mocked(tabInviteData.getPendingByToken).mockResolvedValue(null);

      const result = await tabInviteService.getByToken("invalid-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid or expired link");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if tab or creator not found", async () => {
      vi.mocked(tabInviteData.getPendingByToken).mockResolvedValue({
        tabId: "tab1",
        createdByUserId: "user1",
      });
      vi.mocked(tabInviteData.getTabById).mockResolvedValue(null as any);

      const result = await tabInviteService.getByToken("valid-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tab or creator not found");
      }
    });

    test("success path: returns tab and creator", async () => {
      vi.mocked(tabInviteData.getPendingByToken).mockResolvedValue({
        tabId: "tab1",
        createdByUserId: "user1",
      });
      vi.mocked(tabInviteData.getTabById).mockResolvedValue({
        id: "tab1",
        name: "Test Tab",
      });
      vi.mocked(tabInviteData.getUserById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
      });

      const result = await tabInviteService.getByToken("valid-token");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tabId).toBe("tab1");
        expect(result.data.tab.name).toBe("Test Tab");
        expect(result.data.creator.username).toBe("user1");
      }
    });
  });

  describe("joinByToken", () => {
    test("returns error if token invalid", async () => {
      vi.mocked(tabInviteData.getPendingInviteByToken).mockResolvedValue(null as any);

      const result = await tabInviteService.joinByToken("user1", "invalid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid or expired link");
      }
    });

    test("returns alreadyMember if user already in tab", async () => {
      vi.mocked(tabInviteData.getPendingInviteByToken).mockResolvedValue({
        id: "p1",
        token: "token1",
        tabId: "tab1",
        createdByUserId: "user1",
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      vi.mocked(tabInviteData.isMember).mockResolvedValue(true);

      const result = await tabInviteService.joinByToken("user2", "token1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alreadyMember).toBe(true);
        expect(result.data.tabId).toBe("tab1");
      }
    });
  });

  describe("getToken", () => {
    test("returns error if not a member", async () => {
      vi.mocked(tabInviteData.isMember).mockResolvedValue(false);

      const result = await tabInviteService.getToken("user1", "tab1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
        expect(result.status).toBe(403);
      }
    });
  });

  describe("sendRequest", () => {
    test("returns error if not a member", async () => {
      vi.mocked(tabInviteData.isMember).mockResolvedValue(false);

      const result = await tabInviteService.sendRequest("user1", "tab1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not a member of this tab");
        expect(result.status).toBe(403);
      }
    });

    test("returns error if user not found", async () => {
      vi.mocked(tabInviteData.isMember).mockResolvedValue(true);
      vi.mocked(user.getByUsername).mockResolvedValue(null);

      const result = await tabInviteService.sendRequest("user1", "tab1", "nonexistent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User not found");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if inviting self", async () => {
      vi.mocked(tabInviteData.isMember).mockResolvedValue(true);
      vi.mocked(user.getByUsername).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });

      const result = await tabInviteService.sendRequest("user1", "tab1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("You cannot invite yourself");
      }
    });

    test("returns error if user already member", async () => {
      vi.mocked(tabInviteData.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(user.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });

      const result = await tabInviteService.sendRequest("user1", "tab1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User is already a member");
      }
    });

    test("returns error if invite already sent", async () => {
      vi.mocked(tabInviteData.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vi.mocked(user.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(tabInviteData.checkExistingRequest).mockResolvedValue(true);

      const result = await tabInviteService.sendRequest("user1", "tab1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invite already sent");
      }
    });

    test("success path: sends request and publishes notification", async () => {
      vi.mocked(tabInviteData.isMember)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vi.mocked(user.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(tabInviteData.checkExistingRequest).mockResolvedValue(false);
      vi.mocked(tabInviteData.getTabById).mockResolvedValue({ id: "tab1", name: "Test Tab" });
      vi.mocked(tabInviteData.getUserById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
      });
      vi.mocked(tabInviteData.createRequest).mockResolvedValue({
        id: "req1",
        createdAt: new Date(),
      });

      const result = await tabInviteService.sendRequest("user1", "tab1", "user2");

      expect(result.success).toBe(true);
      expect(tabInviteData.createRequest).toHaveBeenCalledWith({
        tabId: "tab1",
        fromUserId: "user1",
        toUserId: "user2",
      });
      expect(notificationService.publishTabInvite).toHaveBeenCalled();
    });
  });

  describe("acceptRequest", () => {
    test("returns error if request not found", async () => {
      vi.mocked(tabInviteData.getRequestByIdAndToUser).mockResolvedValue(null);

      const result = await tabInviteService.acceptRequest("user1", "req1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Request not found or already handled");
      }
    });
  });

  describe("rejectRequest", () => {
    test("returns error if request not found", async () => {
      vi.mocked(tabInviteData.getRequestByIdAndToUser).mockResolvedValue(null);

      const result = await tabInviteService.rejectRequest("user1", "req1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Request not found or already handled");
      }
    });
  });
});

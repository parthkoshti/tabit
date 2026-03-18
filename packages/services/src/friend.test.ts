import { describe, test, expect, vi, beforeEach } from "vitest";
import { friendService } from "./friend.js";
import { friend as friendData, user as userData, tab } from "data";
import { notificationService } from "./notification.js";

describe("friendService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendRequest", () => {
    test("returns error if username empty", async () => {
      const result = await friendService.sendRequest("user1", "   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Username is required");
        expect(result.status).toBe(400);
      }
    });

    test("returns error if user not found", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue(null);

      const result = await friendService.sendRequest("user1", "nonexistent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User not found");
        expect(result.status).toBe(404);
      }
    });

    test("returns error if adding self", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });

      const result = await friendService.sendRequest("user1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("You cannot add yourself");
      }
    });

    test("returns error if already friends", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(friendData.getDirectTabBetween).mockResolvedValue("tab1");

      const result = await friendService.sendRequest("user1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("You are already friends with this person");
      }
    });

    test("returns error if existing request", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(friendData.getDirectTabBetween).mockResolvedValue(null);
      vi.mocked(friendData.checkExistingRequest).mockResolvedValue(true);

      const result = await friendService.sendRequest("user1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Friend request already sent");
      }
    });

    test("returns error if reverse request exists", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(friendData.getDirectTabBetween).mockResolvedValue(null);
      vi.mocked(friendData.checkExistingRequest).mockResolvedValue(false);
      vi.mocked(friendData.checkReverseRequest).mockResolvedValue(true);

      const result = await friendService.sendRequest("user1", "user2");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("pending request from this person");
      }
    });

    test("success path: sends request and publishes notification", async () => {
      vi.mocked(userData.getByUsername).mockResolvedValue({
        id: "user2",
        name: "User 2",
        username: "user2",
        email: "u2@test.com",
        defaultCurrency: "USD",
      });
      vi.mocked(friendData.getDirectTabBetween).mockResolvedValue(null);
      vi.mocked(friendData.checkExistingRequest).mockResolvedValue(false);
      vi.mocked(friendData.checkReverseRequest).mockResolvedValue(false);
      vi.mocked(friendData.createRequest).mockResolvedValue({
        id: "req1",
        createdAt: new Date(),
      });
      vi.mocked(userData.getById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });

      const result = await friendService.sendRequest("user1", "user2");

      expect(result.success).toBe(true);
      expect(friendData.createRequest).toHaveBeenCalledWith("user1", "user2");
      expect(notificationService.publishFriendRequest).toHaveBeenCalled();
    });
  });

  describe("acceptRequest", () => {
    test("returns error if request not found", async () => {
      vi.mocked(friendData.getRequestByIdAndToUser).mockResolvedValue(null);

      const result = await friendService.acceptRequest("req1", "user1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Request not found or already handled");
        expect(result.status).toBe(404);
      }
    });

    test("success path: creates direct tab and publishes notification", async () => {
      vi.mocked(friendData.getRequestByIdAndToUser).mockResolvedValue({
        id: "req1",
        fromUserId: "user2",
        toUserId: "user1",
        status: "pending",
      });
      vi.mocked(friendData.updateRequestStatus).mockResolvedValue(undefined);
      vi.mocked(userData.getDefaultCurrency).mockResolvedValue("USD");
      vi.mocked(tab.createDirect).mockResolvedValue("tab1");
      vi.mocked(userData.getById).mockResolvedValue({
        id: "user1",
        name: "User 1",
        username: "user1",
        email: "u1@test.com",
        defaultCurrency: "USD",
      });

      const result = await friendService.acceptRequest("req1", "user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.friendTabId).toBe("tab1");
      }
      expect(tab.createDirect).toHaveBeenCalledWith("user1", "user2", "USD");
      expect(notificationService.publishFriendRequestAccepted).toHaveBeenCalled();
    });
  });

  describe("addByToken", () => {
    test("returns error if token empty", async () => {
      const result = await friendService.addByToken("user1", "");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid token");
      }
    });

    test("returns error if token invalid or expired", async () => {
      vi.mocked(friendData.getPendingFriendByToken).mockResolvedValue(null);

      const result = await friendService.addByToken("user1", "invalid-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid or expired link");
      }
    });

    test("returns error if adding self via token", async () => {
      vi.mocked(friendData.getPendingFriendByToken).mockResolvedValue({
        id: "p1",
        token: "token1",
        userId: "user1",
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await friendService.addByToken("user1", "token1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("You cannot add yourself");
      }
    });

    test("success path: creates direct tab when not already friends", async () => {
      vi.mocked(friendData.getPendingFriendByToken).mockResolvedValue({
        id: "p1",
        token: "token1",
        userId: "user2",
        expiresAt: new Date(Date.now() + 86400000),
      });
      vi.mocked(friendData.getDirectTabBetween).mockResolvedValue(null);
      vi.mocked(userData.getDefaultCurrency).mockResolvedValue("USD");
      vi.mocked(tab.createDirect).mockResolvedValue("tab1");

      const result = await friendService.addByToken("user1", "token1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.friendTabId).toBe("tab1");
      }
      expect(tab.createDirect).toHaveBeenCalledWith("user1", "user2", "USD");
    });
  });

  describe("poke", () => {
    test("returns error if friendTabId empty", async () => {
      const result = await friendService.poke("user1", "   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("friendTabId is required");
      }
    });

    test("returns error if not in direct tab", async () => {
      vi.mocked(friendData.isUserInDirectTab).mockResolvedValue(false);

      const result = await friendService.poke("user1", "tab1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tab not found or you are not a member");
      }
    });
  });
});

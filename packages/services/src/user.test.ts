import { describe, test, expect, vi, beforeEach } from "vitest";
import { userService } from "./user.js";
import { user as userData, preference as preferenceData } from "data";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProfile", () => {
    test("returns error if name too long", async () => {
      const longName = "a".repeat(65);

      const result = await userService.updateProfile("user1", { name: longName });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Name must be at most 64 characters");
      }
    });

    test("returns error if invalid currency", async () => {
      const result = await userService.updateProfile("user1", {
        defaultCurrency: "INVALID",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid currency code");
      }
    });

    test("success path: update profile", async () => {
      const result = await userService.updateProfile("user1", {
        name: "New Name",
        defaultCurrency: "EUR",
      });

      expect(result.success).toBe(true);
      expect(userData.updateProfile).toHaveBeenCalledWith("user1", {
        name: "New Name",
        defaultCurrency: "EUR",
      });
    });
  });

  describe("checkUsernameAvailable", () => {
    test("returns false if username too short", async () => {
      const result = await userService.checkUsernameAvailable("user1", "ab");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    test("returns false if username too long", async () => {
      const result = await userService.checkUsernameAvailable("user1", "a".repeat(13));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    test("returns false if invalid characters", async () => {
      const result = await userService.checkUsernameAvailable("user1", "user-name");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    test("returns true if available", async () => {
      vi.mocked(userData.getUsername).mockResolvedValue("current");
      vi.mocked(userData.getByUsernameForId).mockResolvedValue(null);

      const result = await userService.checkUsernameAvailable("user1", "available");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });
  });

  describe("updateUsername", () => {
    test("returns error if username empty", async () => {
      const result = await userService.updateUsername("user1", "   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Username is required");
      }
    });

    test("returns error if username too short", async () => {
      const result = await userService.updateUsername("user1", "ab");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Username must be at least 5 characters");
      }
    });

    test("returns error if username too long", async () => {
      const result = await userService.updateUsername("user1", "a".repeat(13));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Username must be at most 12 characters");
      }
    });

    test("returns error if username taken", async () => {
      vi.mocked(userData.getByUsernameForId).mockResolvedValue("other-user");

      const result = await userService.updateUsername("user1", "takenuser");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Username is already taken");
      }
    });

    test("success path: update username", async () => {
      vi.mocked(userData.getByUsernameForId).mockResolvedValue(null);

      const result = await userService.updateUsername("user1", "newuser");

      expect(result.success).toBe(true);
      expect(userData.updateUsername).toHaveBeenCalledWith("user1", "newuser");
    });
  });

  describe("getPreferences", () => {
    test("returns preferences", async () => {
      vi.mocked(preferenceData.getByUserId).mockResolvedValue([]);

      const result = await userService.getPreferences("user1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });
});

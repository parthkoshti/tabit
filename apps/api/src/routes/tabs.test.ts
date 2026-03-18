import { describe, test, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { tabsRoutes } from "./tabs.js";
import { tabService } from "services";

describe("tabs routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET / returns tabs for user", async () => {
    const mockTabs = [
      {
        id: "tab1",
        name: "Test Tab",
        currency: "USD",
        createdAt: new Date(),
      },
    ];
    vi.mocked(tabService.getTabsForUser).mockResolvedValue({
      success: true,
      data: { tabs: mockTabs },
    });

    const app = new Hono();
    app.route("/tabs", tabsRoutes);

    const res = await app.request("/tabs", {
      headers: { "X-Test-User-Id": "user1" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tabs).toHaveLength(1);
    expect(json.tabs[0].name).toBe("Test Tab");
    expect(tabService.getTabsForUser).toHaveBeenCalledWith("user1");
  });

  test("GET /:tabId returns 403 if not a member", async () => {
    vi.mocked(tabService.getWithMembers).mockResolvedValue({
      success: false,
      error: "Not a member",
      status: 403,
    });

    const app = new Hono();
    app.route("/tabs", tabsRoutes);

    const res = await app.request("/tabs/tab1", {
      headers: { "X-Test-User-Id": "user1" },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Not a member");
  });
});

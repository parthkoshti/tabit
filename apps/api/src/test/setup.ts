import { vi } from "vitest";
import { createMiddleware } from "hono/factory";

// Mock auth - use test middleware that injects userId from header
vi.mock("../auth.js", () => ({
  authMiddleware: createMiddleware<{ Variables: { auth: { userId: string; authType: string } } }>(
    async (c, next) => {
      const userId = c.req.header("X-Test-User-Id") ?? "test-user-1";
      c.set("auth", { userId, authType: "api_key" });
      return next();
    },
  ),
}));

// Mock services
vi.mock("services", () => ({
  expenseService: {
    getForTab: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    bulkImport: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    getAuditLog: vi.fn(),
  },
  tabService: {
    getTabsForUser: vi.fn(),
    getWithMembers: vi.fn(),
    getBalancesForTab: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
  settlementService: {
    getForTab: vi.fn(),
    getById: vi.fn(),
    getAuditLog: vi.fn(),
    record: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

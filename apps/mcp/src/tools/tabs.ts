import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tabService, settlementService, expenseService } from "services";

export function registerTabsTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_tabs",
    {
      description: "List all tabs (expense groups) the user is a member of",
      inputSchema: {},
    },
    async () => {
      const result = await tabService.getTabsForUser(userId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data.tabs, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "create_tab",
    {
      description: "Create a new tab (expense group)",
      inputSchema: {
        name: z.string().describe("Name of the tab"),
      },
    },
    async ({ name }) => {
      const result = await tabService.create(name, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Tab created with ID: ${result.data.tabId}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_tab",
    {
      description: "Get details of a specific tab including members",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
      },
    },
    async ({ tabId }) => {
      const result = await tabService.getWithMembers(tabId, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_expenses",
    {
      description: "List expenses for a tab",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
      },
    },
    async ({ tabId }) => {
      const result = await expenseService.getForTab(tabId, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data.expenses, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_expense",
    {
      description:
        "Add an expense to a tab. Amount in dollars. Description required. paidById defaults to current user.",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
        amount: z.number().describe("Amount in dollars"),
        description: z.string().describe("Description of the expense"),
        paidById: z
          .string()
          .optional()
          .describe("User ID who paid (defaults to current user)"),
      },
    },
    async ({ tabId, amount, description, paidById }) => {
      const result = await expenseService.create(
        {
          tabId,
          amount,
          description,
          paidById: paidById ?? userId,
          splitType: "equal",
          expenseDate: new Date(),
        },
        userId,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Expense added with ID: ${result.data.expenseId}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "delete_expense",
    {
      description: "Delete an expense from a tab",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
        expenseId: z.string().describe("ID of the expense to delete"),
      },
    },
    async ({ tabId, expenseId }) => {
      const result = await expenseService.delete(tabId, expenseId, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Expense deleted",
          },
        ],
      };
    },
  );

  server.registerTool(
    "record_settlement",
    {
      description: "Record a settlement (payment) between two members in a tab",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
        fromUserId: z.string().describe("User ID of the payer"),
        toUserId: z.string().describe("User ID of the payee"),
        amount: z.number().describe("Amount in dollars"),
      },
    },
    async ({ tabId, fromUserId, toUserId, amount }) => {
      const result = await settlementService.record(
        tabId,
        fromUserId,
        toUserId,
        amount,
        userId,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Settlement recorded",
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_tab_balances",
    {
      description: "Get balance summary for a tab",
      inputSchema: {
        tabId: z.string().describe("ID of the tab"),
      },
    },
    async ({ tabId }) => {
      const result = await tabService.getBalancesForTab(tabId, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Api = {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body: unknown) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
};

export function registerTabsTools(server: McpServer, api: Api): void {
  server.registerTool(
    "list_tabs",
    {
      description: "List all tabs (expense groups) the user is a member of",
      inputSchema: {},
    },
    async () => {
      const data = (await api.get("/tabs")) as { success: boolean; tabs: unknown[] };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.tabs, null, 2),
          },
        ],
      };
    }
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
      const data = (await api.post("/tabs", { name })) as {
        success: boolean;
        tabId: string;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Tab created with ID: ${data.tabId}`,
          },
        ],
      };
    }
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
      const data = (await api.get(`/tabs/${tabId}`)) as {
        success: boolean;
        tab: unknown;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.tab, null, 2),
          },
        ],
      };
    }
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
      const data = (await api.get(`/tabs/${tabId}/expenses`)) as {
        success: boolean;
        expenses: unknown[];
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.expenses, null, 2),
          },
        ],
      };
    }
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
        paidById: z.string().optional().describe("User ID who paid (defaults to current user)"),
      },
    },
    async ({ tabId, amount, description, paidById }) => {
      const body: Record<string, unknown> = {
        tabId,
        amount,
        description,
        splitType: "equal",
      };
      if (paidById) body.paidById = paidById;
      const data = (await api.post(`/tabs/${tabId}/expenses`, body)) as {
        success: boolean;
        expenseId: string;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Expense added with ID: ${data.expenseId}`,
          },
        ],
      };
    }
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
      await api.delete(`/tabs/${tabId}/expenses/${expenseId}`);
      return {
        content: [
          {
            type: "text" as const,
            text: "Expense deleted",
          },
        ],
      };
    }
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
      const data = (await api.post(`/tabs/${tabId}/settlements`, {
        tabId,
        fromUserId,
        toUserId,
        amount,
      })) as { success: boolean; error?: string };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Settlement recorded",
          },
        ],
      };
    }
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
      const data = (await api.get(`/tabs/${tabId}/balances`)) as {
        success: boolean;
        balances: unknown;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.balances, null, 2),
          },
        ],
      };
    }
  );
}

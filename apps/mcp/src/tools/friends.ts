import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Api = {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body?: unknown) => Promise<unknown>;
};

export function registerFriendsTools(server: McpServer, api: Api): void {
  server.registerTool(
    "list_friends",
    {
      description: "List the user's friends (direct tabs)",
      inputSchema: {},
    },
    async () => {
      const data = (await api.get("/friends")) as { success: boolean; friends: unknown[] };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.friends, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "send_friend_request",
    {
      description: "Send a friend request to a user by username",
      inputSchema: {
        username: z.string().describe("Username of the user to add as friend"),
      },
    },
    async ({ username }) => {
      const data = (await api.post("/friends/requests", { username })) as {
        success: boolean;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request sent successfully",
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_pending_friend_requests",
    {
      description: "Get pending friend requests received by the user",
      inputSchema: {},
    },
    async () => {
      const data = (await api.get("/friends/requests/pending")) as {
        success: boolean;
        requests: unknown[];
      };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.requests, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "accept_friend_request",
    {
      description: "Accept a pending friend request by ID",
      inputSchema: {
        requestId: z.string().describe("ID of the friend request to accept"),
      },
    },
    async ({ requestId }) => {
      const data = (await api.post(`/friends/requests/${requestId}/accept`)) as {
        success: boolean;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request accepted",
          },
        ],
      };
    }
  );

  server.registerTool(
    "reject_friend_request",
    {
      description: "Reject a pending friend request by ID",
      inputSchema: {
        requestId: z.string().describe("ID of the friend request to reject"),
      },
    },
    async ({ requestId }) => {
      await api.post(`/friends/requests/${requestId}/reject`);
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request rejected",
          },
        ],
      };
    }
  );

  server.registerTool(
    "add_friend_by_token",
    {
      description: "Add a friend using an invite token",
      inputSchema: {
        token: z.string().describe("Invite token from the friend"),
      },
    },
    async ({ token }) => {
      const data = (await api.post("/friends/add-by-token", { token })) as {
        success: boolean;
        error?: string;
      };
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend added successfully",
          },
        ],
      };
    }
  );
}

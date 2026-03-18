import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { friendService } from "services";

export function registerFriendsTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_friends",
    {
      description: "List the user's friends (direct tabs)",
      inputSchema: {},
    },
    async () => {
      const result = await friendService.getFriends(userId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data.friends, null, 2),
          },
        ],
      };
    },
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
      const result = await friendService.sendRequest(userId, username);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request sent successfully",
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_pending_friend_requests",
    {
      description: "Get pending friend requests received by the user",
      inputSchema: {},
    },
    async () => {
      const result = await friendService.getPendingRequests(userId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data.requests, null, 2),
          },
        ],
      };
    },
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
      const result = await friendService.acceptRequest(requestId, userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request accepted",
          },
        ],
      };
    },
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
      await friendService.rejectRequest(requestId, userId);
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend request rejected",
          },
        ],
      };
    },
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
      const result = await friendService.addByToken(userId, token);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "Friend added successfully",
          },
        ],
      };
    },
  );
}

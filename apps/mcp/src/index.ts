import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFriendsTools } from "./tools/friends.js";
import { registerTabsTools } from "./tools/tabs.js";
import { apiKeyData } from "data";

const apiKey = process.env.TABIT_API_KEY ?? process.env.API_KEY;

if (!apiKey) {
  console.error("TABIT_API_KEY or API_KEY environment variable is required");
  process.exit(1);
}

const userId = await apiKeyData.getUserIdByKey(apiKey);
if (!userId) {
  console.error("Invalid or expired API key");
  process.exit(1);
}

const server = new McpServer(
  {
    name: "tabit-mcp",
    version: "1.0.0",
  },
  { capabilities: { tools: {} } }
);

registerFriendsTools(server, userId);
registerTabsTools(server, userId);

const transport = new StdioServerTransport();
await server.connect(transport);

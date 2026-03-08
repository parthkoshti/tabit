import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerFriendsTools } from "./tools/friends.js";
import { registerTabsTools } from "./tools/tabs.js";

const apiUrl = process.env.TABIT_API_URL ?? process.env.API_URL ?? "http://localhost:3001";
const apiKey = process.env.TABIT_API_KEY ?? process.env.API_KEY;

if (!apiKey) {
  console.error("TABIT_API_KEY or API_KEY environment variable is required");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
};

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${apiUrl}${path}`, { headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function apiPatch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function apiDelete(path: string): Promise<unknown> {
  const res = await fetch(`${apiUrl}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

const api = { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete };

const server = new McpServer(
  {
    name: "tabit-mcp",
    version: "1.0.0",
  },
  { capabilities: { tools: {} } }
);

registerFriendsTools(server, api);
registerTabsTools(server, api);

const transport = new StdioServerTransport();
await server.connect(transport);

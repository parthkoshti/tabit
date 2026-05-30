import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "rpc";

function getRpcUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  if (base) {
    return `${base.replace(/\/$/, "")}/rpc`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rpc`;
  }
  return "http://localhost:3003/rpc";
}

const link = new RPCLink({
  url: getRpcUrl(),
  fetch: (request, init) =>
    globalThis.fetch(request, {
      ...init,
      credentials: "include",
    }),
});

export const orpcClient: RouterClient<AppRouter> = createORPCClient(link);

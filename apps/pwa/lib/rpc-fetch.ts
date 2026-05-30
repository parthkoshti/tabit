/**
 * Minimal oRPC over HTTP for service worker (no orpc client bundle).
 * Uses the same POST /rpc protocol as @orpc/client.
 */

function getApiBase(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  if (!base) return "";
  return base.replace(/\/$/, "");
}

function getRpcUrl(): string {
  const base = getApiBase();
  return base ? `${base}/rpc` : "/rpc";
}

type RpcCall = {
  path: string[];
  input?: unknown;
};

export async function rpcCall<T>(procedure: string[], input?: unknown): Promise<T> {
  const body: RpcCall = { path: procedure, input };
  const res = await fetch(getRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `RPC failed: ${res.status}`);
  }
  const json = (await res.json()) as { json?: T; error?: { message?: string } };
  if (json && typeof json === "object" && "error" in json && json.error) {
    throw new Error(json.error.message ?? "RPC error");
  }
  if (json && typeof json === "object" && "json" in json) {
    return json.json as T;
  }
  return json as T;
}

export function getApiUrlForSw(): string {
  return getApiBase() || "";
}

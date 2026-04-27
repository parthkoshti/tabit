/** Validate IANA zone without pulling Luxon into the API package. */
export function parseValidIanaZone(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return null;
  }
}

function isPrivateOrLoopbackIpv4(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "0.0.0.0") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (ip === "::1" || ip === "localhost") return true;
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  return isPrivateOrLoopbackIpv4(ip);
}

/** Best-effort client IP when behind Cloudflare or a reverse proxy. */
export function getRequestClientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const trueClient = headers.get("true-client-ip")?.trim();
  if (trueClient) return trueClient;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return null;
}

/**
 * IANA zone from edge / proxy headers (e.g. a Worker in front can set
 * `CF-Timezone` from `request.cf.timezone`).
 */
export function suggestedTimezoneFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get("cf-timezone") ??
    headers.get("CF-Timezone") ??
    headers.get("x-detected-timezone") ??
    headers.get("X-Detected-Timezone");
  return parseValidIanaZone(raw);
}

const IPWHO_RE = /^[0-9a-f:.]+$/i;

async function timezoneFromPublicIp(ip: string): Promise<string | null> {
  if (!IPWHO_RE.test(ip) || isPrivateOrLoopbackIp(ip)) return null;
  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      timezone?: { id?: string };
    };
    if (!data.success || !data.timezone?.id) return null;
    return parseValidIanaZone(data.timezone.id);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Suggested IANA timezone for this request: CF/proxy headers first, then
 * optional IP geolocation (`ipwho.is`). Set `TIMEZONE_IP_LOOKUP=0` to skip IP.
 */
export async function resolveSuggestedTimezoneForRequest(
  headers: Headers,
): Promise<string | null> {
  const fromHeaders = suggestedTimezoneFromHeaders(headers);
  if (fromHeaders) return fromHeaders;

  const ipLookup =
    (process.env.TIMEZONE_IP_LOOKUP ?? "1").toLowerCase() !== "0" &&
    process.env.TIMEZONE_IP_LOOKUP !== "false";
  if (!ipLookup) return null;

  const ip = getRequestClientIp(headers);
  if (!ip) return null;

  return timezoneFromPublicIp(ip);
}

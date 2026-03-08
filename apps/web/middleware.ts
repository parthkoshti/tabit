import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/sw.js" && process.env.NODE_ENV === "development") {
    console.log("[SW] Service worker script requested (update check)");
  }
  return NextResponse.next();
}

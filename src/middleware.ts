import { NextRequest, NextResponse } from "next/server";

const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- CORS for API routes (from previous middleware) ---
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();
    const origin = request.headers.get("origin");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, PATCH, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return response;
  }

  // --- Skip static files ---
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // --- Allow override via query param ?desktop=1 / ?mobile=1 ---
  const desktopOverride = request.nextUrl.searchParams.get("desktop");
  const mobileOverride = request.nextUrl.searchParams.get("mobile");

  if (desktopOverride === "1" && pathname.startsWith("/m")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("desktop");
    return NextResponse.redirect(url);
  }
  if (mobileOverride === "1" && !pathname.startsWith("/m")) {
    const url = request.nextUrl.clone();
    url.pathname = "/m";
    url.searchParams.delete("mobile");
    return NextResponse.redirect(url);
  }

  // --- User-Agent based redirect ---
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_UA_REGEX.test(userAgent);

  // Mobile accessing desktop root → redirect to /m
  if (isMobile && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  // Desktop accessing mobile route → redirect to /
  if (!isMobile && pathname === "/m") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

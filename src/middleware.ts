import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const response = NextResponse.next();

  // Get the origin from the request
  const origin = request.headers.get("origin");

  // Allow requests from any origin (for public tunnel access)
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.get("authenticated")?.value === "true";

  // Protect /app route
  if (pathname.startsWith("/app") && !isAuthenticated) {
    // Check sessionStorage is not available in middleware, so we'll check cookie
    // The client-side will set a cookie when authenticating
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect authenticated users away from login page
  if (pathname === "/" && isAuthenticated) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app"],
};



import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.get("authenticated")?.value === "true";

  // Protect all routes under /app
  if (pathname.startsWith("/app")) {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Allow access if authenticated
    return NextResponse.next();
  }

  // Redirect authenticated users away from login page
  if (pathname === "/" && isAuthenticated) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/app";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};



import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  validateSessionToken
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Runs on the Node.js runtime so sessions are checked against the database
// on every page, data request, and server action.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"]
};

const PUBLIC_PATHS = ["/login", "/setup"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Login and first-run setup do their own checks.
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const result = await validateSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (result) {
    const response = NextResponse.next();

    if (result.renewed) {
      const secure =
        request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https";
      response.cookies.set(
        SESSION_COOKIE,
        request.cookies.get(SESSION_COOKIE)!.value,
        sessionCookieOptions(secure, result.session.expiresAt)
      );
    }

    return response;
  }

  const hasUsers = (await prisma.user.count()) > 0;
  const target = request.nextUrl.clone();
  target.search = "";

  if (hasUsers) {
    target.pathname = "/login";
    if (pathname !== "/") {
      target.searchParams.set("next", `${pathname}${search}`);
    }
  } else {
    target.pathname = "/setup";
  }

  const response = NextResponse.redirect(target);

  if (request.cookies.has(SESSION_COOKIE)) {
    response.cookies.delete(SESSION_COOKIE);
  }

  return response;
}

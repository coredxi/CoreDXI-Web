import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";
import { buildCsp } from "@/lib/csp";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("content-security-policy");
  requestHeaders.delete("content-security-policy-report-only");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const next = () =>
    withCsp(NextResponse.next({ request: { headers: requestHeaders } }));

  if (
    req.nextUrl.pathname.startsWith("/concepts") &&
    process.env.NODE_ENV === "production"
  ) {
    return withCsp(new NextResponse("Not Found", { status: 404 }));
  }

  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return next();
  }

  if (req.nextUrl.pathname === "/admin/login") {
    return next();
  }

  if (!req.auth) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return withCsp(NextResponse.redirect(login));
  }

  const { accountType, role } = req.auth.user ?? {};
  if (
    accountType !== "admin" ||
    (role !== "SUPER_ADMIN" && role !== "EDITOR")
  ) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("error", "Forbidden");
    return withCsp(NextResponse.redirect(login));
  }

  return next();
});

export const config = {
  matcher: [
    "/((?!api/auth/(?:callback|csrf|session|signin|signout|providers|error)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

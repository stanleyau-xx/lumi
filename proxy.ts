import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export default async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const session = token ? {
    user: {
      id: token.id as string,
      role: token.role as string,
    }
  } : null;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiAuthRoute = pathname.startsWith("/api/auth");
  const isPublicRoute = pathname === "/" || pathname.startsWith("/api/public");

  if (isApiAuthRoute || isPublicRoute) {
    return NextResponse.next();
  }

  if (isAuthPage) {
    if (session) {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

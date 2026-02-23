import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

type UserRole = "ADMIN" | "SUPERVISOR" | "EMPLOYEE";

const accessMap: Record<string, UserRole[]> = {
  "/dashboard": ["ADMIN", "SUPERVISOR"],
  "/employees": ["ADMIN", "SUPERVISOR", "EMPLOYEE"],
  "/attendance": ["ADMIN", "SUPERVISOR"],
  "/payroll": ["ADMIN", "SUPERVISOR"],
  "/me": ["ADMIN", "SUPERVISOR", "EMPLOYEE"],
};

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    const protectedPath = Object.keys(accessMap).find((p) => pathname.startsWith(p));
    if (!protectedPath) return NextResponse.next();

    const role = token?.role as UserRole | undefined;
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const allowed = accessMap[protectedPath];
    if (!allowed.includes(role)) {
      return NextResponse.redirect(new URL("/me", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const needsAuth = Object.keys(accessMap).some((path) => pathname.startsWith(path));
        return needsAuth ? !!token : true;
      },
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*", "/employees/:path*", "/attendance/:path*", "/payroll/:path*", "/me/:path*"],
};

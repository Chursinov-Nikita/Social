import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/components/login") ||
    pathname.startsWith("/components/register");

  const isProtected =
    pathname.startsWith("/components/profile") ||
    pathname.startsWith("/components/friends") ||
    pathname.startsWith("/components/chat");

  // Не авторизован → редирект на логин
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/components/login", request.url));
  }

  // Уже авторизован → редирект с логина на фид
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/components/profile/:path*",
    "/components/friends/:path*",
    "/components/chat/:path*",
    "/components/login/:path*",
    "/components/register/:path*",
  ],
};

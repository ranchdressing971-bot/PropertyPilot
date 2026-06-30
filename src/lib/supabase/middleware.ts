import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseProjectUrl,
  validateSupabaseProjectUrl,
} from "./config";
import { isProfileComplete, profileFromUser } from "@/lib/profile";

export async function updateSession(request: NextRequest) {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseAnonKey();

  let supabaseResponse = NextResponse.next({ request });

  if (!url || !key || validateSupabaseProjectUrl(url)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const mode = request.cookies.get("pp-mode")?.value;
  const isDemo = mode === "demo";
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isDashboard && !isDemo && !user && !isAuthPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    const dashboardUrl = request.nextUrl.clone();
    const profile = profileFromUser(user);
    dashboardUrl.pathname = isProfileComplete(profile)
      ? "/dashboard"
      : "/dashboard/profile/setup";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/api/inspection/:path*",
    "/api/analyze-inspection",
    "/api/live/dashboard",
    "/api/setup-status",
    // Nexus operator surfaces need session refresh so the admin gate keeps
    // working after the access token expires. /api/nexus/tick is intentionally
    // excluded: the scheduler calls it with a bearer secret and no cookies.
    "/nexus/:path*",
    "/nexus",
    "/api/nexus/search",
    "/api/nexus/state",
  ],
};

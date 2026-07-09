import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Shareable sales demo link.
 * Sets demo mode cookie and sends visitors into the sample inspection.
 * Example: https://property-pilot-gold.vercel.app/demo
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard/inspections/insp-1";
  url.search = "";

  const response = NextResponse.redirect(url);
  response.cookies.set("pp-mode", "demo", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  return response;
}

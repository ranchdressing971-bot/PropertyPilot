import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  const supabase = await createClient();
  const admin = createAdminClient();

  const status = {
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
    auth: {
      signedIn: Boolean(userId),
    },
    database: {
      tableReadable: false,
      tableWritable: false,
      inspectionCount: 0 as number | null,
      error: null as string | null,
    },
    fixes: [] as string[],
  };

  if (!status.env.supabaseUrl || !status.env.supabaseAnon) {
    status.fixes.push(
      "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, then redeploy."
    );
  }

  if (!status.env.serviceRole) {
    status.fixes.push(
      "Add SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role secret) in Vercel and .env.local, then redeploy."
    );
  }

  if (!status.auth.signedIn) {
    status.fixes.push("Sign in before running Live scans — guest sessions cannot save to the database.");
  }

  if (admin) {
    const { error, count } = await admin
      .from("inspections")
      .select("*", { count: "exact", head: true });

    if (error) {
      status.database.error = error.message;
      if (error.message.includes("permission denied") || error.code === "42501") {
        status.fixes.push(
          "Run docs/FIX_SUPABASE.sql in Supabase → SQL Editor (fixes table permissions)."
        );
      }
      if (error.message.includes("does not exist") || error.code === "42P01") {
        status.fixes.push(
          "Run docs/schema.sql in Supabase → SQL Editor to create tables."
        );
      }
    } else {
      status.database.tableReadable = true;
      status.database.inspectionCount = count;
    }
  } else if (status.env.supabaseUrl && status.env.supabaseAnon) {
    status.database.error = "No service role key — cannot verify database from server.";
  }

  if (supabase && userId) {
    const testId = `setup-test-${Date.now()}`;
    const { error: insertError } = await supabase.from("inspections").insert({
      id: testId,
      user_id: userId,
      name: "Setup test (safe to delete)",
      video_name: "test",
      neighborhood: "test",
      results: [],
      violations: [],
      metadata: {},
    });

    if (insertError) {
      status.database.error = insertError.message;
      if (
        insertError.message.includes("permission denied") ||
        insertError.code === "42501"
      ) {
        status.fixes.push(
          "Run docs/FIX_SUPABASE.sql in Supabase → SQL Editor — your user cannot write inspections yet."
        );
      }
    } else {
      status.database.tableWritable = true;
      await supabase.from("inspections").delete().eq("id", testId);
    }
  }

  status.fixes = [...new Set(status.fixes)];

  const ok =
    status.env.supabaseUrl &&
    status.env.supabaseAnon &&
    status.env.serviceRole &&
    status.auth.signedIn &&
    status.database.tableReadable &&
    status.database.tableWritable;

  return NextResponse.json({ ok, ...status });
}

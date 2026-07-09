import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No video file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Video must be under 100 MB" },
        { status: 400 }
      );
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json({
        stored: false,
        message: "Supabase not configured — video still analyzed from frames",
        videoName: file.name,
        sizeBytes: file.size,
      });
    }

    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${userId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("inspection-videos")
      .upload(path, buffer, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({
        stored: false,
        message: "Storage bucket not configured — video still analyzed from frames",
        videoName: file.name,
        storageError: error.message,
      });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("inspection-videos")
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    return NextResponse.json({
      stored: true,
      path,
      url: signed?.signedUrl ?? null,
      signError: signError?.message,
      videoName: file.name,
      sizeBytes: file.size,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

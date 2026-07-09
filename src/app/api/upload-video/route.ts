import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";
import { safeStorageSegment } from "@/lib/image-data-url";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

function safeExt(fileName: string, mime: string): string {
  const raw = (fileName.split(".").pop() || "").toLowerCase();
  if (/^(mp4|mov|webm|m4v)$/.test(raw)) return raw;
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
}

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
      // Cloud backup is optional — analysis still runs from frames
      return NextResponse.json({
        stored: false,
        message: "Sign in for cloud video backup (analysis still works)",
        videoName: file.name,
        sizeBytes: file.size,
      });
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

    const ext = safeExt(file.name, file.type || "");
    const path = `${safeStorageSegment(userId)}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("inspection-videos")
      .upload(path, buffer, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

    if (error) {
      // Never fail the inspection flow because of optional cloud backup
      console.error("video upload skipped:", error.message);
      return NextResponse.json({
        stored: false,
        message: "Storage backup skipped — video still analyzed from frames",
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
    // Soft-fail — frame analysis is the source of truth
    return NextResponse.json({
      stored: false,
      message: msg,
      error: msg,
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isOpenAIConfigured } from "@/lib/app-mode";
import { runAddressDetection } from "@/lib/address-detect-run";
import type { Property } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY required for address detection" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const imageUrls = (body.imageUrls as string[]) ?? [];
    const roster = (body.roster as Property[]) ?? [];

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Provide imageUrls array of frame data URLs" },
        { status: 400 }
      );
    }

    const detections = await runAddressDetection(imageUrls, roster);
    return NextResponse.json({ detections });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Detection failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

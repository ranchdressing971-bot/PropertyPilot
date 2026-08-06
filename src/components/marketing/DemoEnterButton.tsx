"use client";

import { useRouter } from "next/navigation";
import { DEMO_MODE_COOKIE } from "@/lib/demo/data";

export function DemoEnterButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn-primary px-5 py-3 text-base"
      onClick={() => {
        document.cookie = `${DEMO_MODE_COOKIE}=demo; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        router.push("/dashboard");
      }}
    >
      Open demo shop
    </button>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Home } from "lucide-react";

function isSupabaseOrDataUrl(src: string): boolean {
  return (
    src.startsWith("data:") ||
    src.includes("supabase.co/storage/") ||
    src.includes("/storage/v1/object/")
  );
}

interface MediaImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Fill parent with absolute positioning (parent must be relative) */
  fill?: boolean;
  width?: number;
  height?: number;
}

/**
 * Safe image for evidence/thumbnails.
 * Signed Supabase URLs break next/Image remotePatterns — use <img> for those.
 */
export function MediaImage({
  src,
  alt,
  className = "object-cover",
  fill,
  width,
  height,
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-100 ${fill ? "absolute inset-0" : ""} ${className}`}
      >
        <Home className="h-8 w-8 text-ink-300" />
      </div>
    );
  }

  if (isSupabaseOrDataUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        className={fill ? `absolute inset-0 h-full w-full ${className}` : className}
        style={fill ? undefined : width && height ? { width, height } : undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        unoptimized
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 112}
      height={height ?? 80}
      className={className}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

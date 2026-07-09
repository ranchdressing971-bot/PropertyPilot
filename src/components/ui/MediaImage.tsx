"use client";

import { useState } from "react";
import { Home } from "lucide-react";

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
 * Always uses <img> — next/Image + signed Supabase / flaky CDNs show broken icons.
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

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={fill ? `absolute inset-0 h-full w-full ${className}` : className}
      style={fill ? undefined : width && height ? { width, height } : undefined}
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

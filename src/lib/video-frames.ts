/**
 * Client-side video frame extraction using the browser Video API + Canvas.
 * No FFmpeg required — works on phone uploads and desktop.
 */

export interface ExtractedFrame {
  index: number;
  /** Seconds into the video */
  timestamp: number;
  /** JPEG data URL suitable for OpenAI vision */
  dataUrl: string;
}

export interface ExtractFramesOptions {
  /** Capture one frame every N seconds (default 2) */
  intervalSec?: number;
  /** Hard cap on frames to control API cost and payload size (default 16) */
  maxFrames?: number;
  /** Scale down wide videos before JPEG encode (default 960) */
  maxWidth?: number;
  /** JPEG quality 0–1 (default 0.65) */
  quality?: number;
}

function loadVideoMetadata(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read video file"));
    video.src = url;
    video.load();
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Video seek timed out — try a shorter clip or MP4 format"));
    }, 10000);

    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

/**
 * Extract evenly-spaced JPEG frames from a local video file.
 */
export async function extractVideoFrames(
  file: File,
  options: ExtractFramesOptions = {}
): Promise<ExtractedFrame[]> {
  const {
    intervalSec = 2,
    maxFrames = 16,
    maxWidth = 960,
    quality = 0.65,
  } = options;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  try {
    await loadVideoMetadata(video, url);

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Video has no readable duration");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const frames: ExtractedFrame[] = [];
    const step = Math.max(intervalSec, duration / maxFrames);

    for (let t = 0, idx = 0; t < duration && frames.length < maxFrames; t += step, idx++) {
      await seekVideo(video, t);

      const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      frames.push({
        index: idx,
        timestamp: t,
        dataUrl: canvas.toDataURL("image/jpeg", quality),
      });
    }

    if (frames.length === 0) {
      throw new Error("No frames could be extracted from this video");
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

/** Rough payload size estimate for API limits */
export function estimateFramesPayloadKb(frames: ExtractedFrame[]): number {
  const bytes = frames.reduce((sum, f) => sum + f.dataUrl.length, 0);
  return Math.round(bytes / 1024);
}

/**
 * Client-side video frame extraction using the browser Video API + Canvas.
 * Prefers scene-change frames over blind fixed-interval sampling when possible.
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
  /** Hard cap on frames to control API cost and payload size (default 14) */
  maxFrames?: number;
  /** Scale down wide videos before JPEG encode (default 960) */
  maxWidth?: number;
  /** JPEG quality 0–1 (default 0.68) */
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

/** Cheap luminance fingerprint for scene-change scoring (downsampled). */
function frameFingerprint(ctx: CanvasRenderingContext2D, w: number, h: number): number[] {
  const sampleW = 32;
  const sampleH = 18;
  const tmp = document.createElement("canvas");
  tmp.width = sampleW;
  tmp.height = sampleH;
  const tctx = tmp.getContext("2d");
  if (!tctx) return [];
  tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sampleW, sampleH);
  const { data } = tctx.getImageData(0, 0, sampleW, sampleH);
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return out;
}

function fingerprintDiff(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / (a.length * 255);
}

/**
 * Extract JPEG frames from a local video file.
 * Samples denser candidates, then keeps the most scene-diverse set within maxFrames.
 */
export async function extractVideoFrames(
  file: File,
  options: ExtractFramesOptions = {}
): Promise<ExtractedFrame[]> {
  const {
    intervalSec = 1.8,
    maxFrames = 14,
    maxWidth = 960,
    quality = 0.68,
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

    // Over-sample candidates (~2x), then pick diverse frames
    const candidateCap = Math.min(maxFrames * 2, 28);
    const step = Math.max(intervalSec * 0.65, duration / candidateCap);

    type Candidate = ExtractedFrame & { fingerprint: number[]; score: number };
    const candidates: Candidate[] = [];
    let prevFp: number[] = [];

    for (
      let t = 0, idx = 0;
      t < duration && candidates.length < candidateCap;
      t += step, idx++
    ) {
      await seekVideo(video, t);

      const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const fingerprint = frameFingerprint(ctx, canvas.width, canvas.height);
      const change = prevFp.length ? fingerprintDiff(prevFp, fingerprint) : 1;
      prevFp = fingerprint;

      candidates.push({
        index: idx,
        timestamp: t,
        dataUrl: canvas.toDataURL("image/jpeg", quality),
        fingerprint,
        score: change,
      });
    }

    if (candidates.length === 0) {
      throw new Error("No frames could be extracted from this video");
    }

    // Always keep first + last, then greedily pick highest scene-change scores
    const selected: Candidate[] = [];
    const used = new Set<number>();

    const take = (c: Candidate) => {
      if (used.has(c.index)) return;
      used.add(c.index);
      selected.push(c);
    };

    take(candidates[0]);
    if (candidates.length > 1) take(candidates[candidates.length - 1]);

    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    for (const c of ranked) {
      if (selected.length >= maxFrames) break;
      // Prefer frames that differ from already-selected ones
      const minDiff = Math.min(
        ...selected.map((s) => fingerprintDiff(s.fingerprint, c.fingerprint))
      );
      if (minDiff < 0.04 && selected.length > 2) continue;
      take(c);
    }

    // Fill remaining slots chronologically if still short
    for (const c of candidates) {
      if (selected.length >= maxFrames) break;
      take(c);
    }

    const frames = selected
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((c, i) => ({
        index: i,
        timestamp: c.timestamp,
        dataUrl: c.dataUrl,
      }));

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

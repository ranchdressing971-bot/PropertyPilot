/**
 * Client-side video frame extraction using the browser Video API + Canvas.
 * Prefers scene-change + contentful frames over blind fixed-interval sampling.
 * Candidate step stays under ~0.7s so brief (~1s) house flashes are not missed.
 */

import { sanitizeImageDataUrl } from "./image-data-url";

export interface ExtractedFrame {
  index: number;
  /** Seconds into the video */
  timestamp: number;
  /** JPEG data URL suitable for OpenAI vision */
  dataUrl: string;
  /**
   * 0–1 spatial detail from the luminance fingerprint.
   * Near 0 ≈ blank/uniform; higher ≈ textured scene (house, street).
   */
  contentScore?: number;
}

export interface ExtractFramesOptions {
  /**
   * Soft target spacing for final frames (default 1.2).
   * Candidates are always sampled denser than this so short flashes are caught.
   */
  intervalSec?: number;
  /** Hard cap on frames to control API cost and payload size (default 16) */
  maxFrames?: number;
  /** Scale down wide videos before JPEG encode (default 960) */
  maxWidth?: number;
  /** JPEG quality 0–1 (default 0.68) */
  quality?: number;
}

/** Below this content score a frame is treated as near-blank. */
export const BLANK_CONTENT_THRESHOLD = 0.045;

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
      reject(new Error("Video seek timed out. Try a shorter clip or MP4 format"));
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
export function frameFingerprintFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number[] {
  // Expect already-downsampled image data (32×18). Average RGB → luminance.
  void width;
  void height;
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return out;
}

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
  return frameFingerprintFromImageData(data, sampleW, sampleH);
}

export function fingerprintDiff(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / (a.length * 255);
}

/** Normalized RMS contrast — blanks are near 0, house scenes typically > 0.08. */
export function fingerprintContentScore(fp: number[]): number {
  if (!fp.length) return 0;
  const mean = fp.reduce((s, v) => s + v, 0) / fp.length;
  let varSum = 0;
  for (const v of fp) varSum += (v - mean) ** 2;
  return Math.sqrt(varSum / fp.length) / 255;
}

/**
 * Candidate sample times: dense enough to catch ~1s flashes, capped for cost.
 * Exported for offline tests that mirror the product sampler.
 */
export function computeCandidateTimes(
  duration: number,
  maxFrames: number
): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];

  // Oversample ~3× final budget; hard cap keeps seeks bounded.
  const candidateCap = Math.min(Math.max(maxFrames * 3, 36), 48);
  // Never step longer than 0.7s — a 1s flash must contain ≥1 candidate.
  const step = Math.min(0.7, Math.max(0.35, duration / candidateCap));

  const times: number[] = [];
  for (let t = 0; t < duration && times.length < candidateCap; t += step) {
    times.push(Number(t.toFixed(4)));
  }
  // Ensure we probe near the end
  const last = Math.max(0, duration - 0.05);
  if (times.length === 0 || last - times[times.length - 1] > step * 0.4) {
    if (times.length < candidateCap) times.push(Number(last.toFixed(4)));
  }
  return times;
}

export interface FrameCandidate {
  index: number;
  timestamp: number;
  fingerprint: number[];
  change: number;
  contentScore: number;
  rankScore: number;
  dataUrl?: string;
}

/** Select up to maxFrames from scored candidates (scene change + content). */
export function selectDiverseFrames<T extends FrameCandidate>(
  candidates: T[],
  maxFrames: number
): T[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= maxFrames) {
    return [...candidates].sort((a, b) => a.timestamp - b.timestamp);
  }

  const selected: T[] = [];
  const used = new Set<number>();

  const take = (c: T) => {
    if (used.has(c.index)) return;
    used.add(c.index);
    selected.push(c);
  };

  const isBlank = (c: T) => c.contentScore < BLANK_CONTENT_THRESHOLD;
  const tooSimilar = (c: T, threshold: number) => {
    if (selected.length === 0) return false;
    const minDiff = Math.min(
      ...selected.map((s) => fingerprintDiff(s.fingerprint, c.fingerprint))
    );
    return minDiff < threshold;
  };

  // Prefer starting on content, not a forced blank first/last pair
  const firstContent = candidates.find((c) => !isBlank(c)) ?? candidates[0];
  take(firstContent);

  const ranked = [...candidates].sort((a, b) => b.rankScore - a.rankScore);

  // Pass 1: contentful, scene-diverse frames only (skip blank flashes)
  for (const c of ranked) {
    if (selected.length >= maxFrames) break;
    if (isBlank(c)) continue;
    if (tooSimilar(c, 0.035)) continue;
    take(c);
  }

  // Pass 2: more contentful fills if still short
  const byContent = [...candidates]
    .filter((c) => !isBlank(c))
    .sort((a, b) => b.contentScore - a.contentScore);
  for (const c of byContent) {
    if (selected.length >= maxFrames) break;
    if (tooSimilar(c, 0.03)) continue;
    take(c);
  }

  // Prefer fewer contentful frames over padding with blanks — blank slots
  // waste vision tokens and dilute home-discovery on sparse flash videos.
  if (selected.some((c) => !isBlank(c))) {
    return selected.sort((a, b) => a.timestamp - b.timestamp);
  }

  // All-blank / unscored fallback: keep temporal coverage
  for (const c of ranked) {
    if (selected.length >= maxFrames) break;
    if (tooSimilar(c, 0.08)) continue;
    take(c);
  }
  for (const c of candidates) {
    if (selected.length >= maxFrames) break;
    take(c);
  }

  return selected.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Extract JPEG frames from a local video file.
 * Samples dense candidates, then keeps the most scene-diverse + contentful set.
 */
export async function extractVideoFrames(
  file: File,
  options: ExtractFramesOptions = {}
): Promise<ExtractedFrame[]> {
  const {
    intervalSec = 1.2,
    maxFrames = 16,
    maxWidth = 960,
    quality = 0.68,
  } = options;

  // intervalSec is reserved for callers that want coarser final spacing hints;
  // candidate density is driven by maxFrames so short flashes stay catchable.
  void intervalSec;

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

    const times = computeCandidateTimes(duration, maxFrames);
    const candidates: FrameCandidate[] = [];
    let prevFp: number[] = [];

    for (let idx = 0; idx < times.length; idx++) {
      const t = times[idx];
      await seekVideo(video, t);

      const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const fingerprint = frameFingerprint(ctx, canvas.width, canvas.height);
      const change = prevFp.length ? fingerprintDiff(prevFp, fingerprint) : 1;
      const contentScore = fingerprintContentScore(fingerprint);
      prevFp = fingerprint;

      const rawUrl = canvas.toDataURL("image/jpeg", quality);
      const dataUrl = sanitizeImageDataUrl(rawUrl);
      if (!dataUrl) continue;

      // Rank: scene-change × content boost (blanks rarely win slots)
      const contentBoost = 0.3 + 0.7 * Math.min(1, contentScore / 0.1);
      candidates.push({
        index: idx,
        timestamp: t,
        fingerprint,
        change,
        contentScore,
        rankScore: change * contentBoost,
        dataUrl,
      });
    }

    if (candidates.length === 0) {
      throw new Error("No frames could be extracted from this video");
    }

    const selected = selectDiverseFrames(candidates, maxFrames);

    return selected.map((c, i) => ({
      index: i,
      timestamp: c.timestamp,
      dataUrl: c.dataUrl!,
      contentScore: c.contentScore,
    }));
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { NovaMeshOrb } from "@/components/nova/NovaMeshOrb";
import {
  NovaBarChart,
  NovaDonut,
  NovaFunnel,
  NovaGauge,
  NovaRadarBars,
  NovaSparkline,
} from "@/components/nova/NovaHudViz";
import {
  forceSplitLongRest,
  pullCompleteSentences,
  splitIntoSpeakChunks,
} from "@/lib/nova/speak-chunks";

type Phase =
  | "idle"
  | "listening_wake"
  | "listening_command"
  | "thinking"
  | "speaking";

type ListenMode = "wake" | "command";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface StatusPayload {
  sendEnabled: boolean;
  novaArmed: boolean;
  dailyTarget: number;
  withinWindow: boolean;
  plannedProvider?: string;
  mailtrapVerified?: boolean;
  resendConfigured?: boolean;
  customDomainLikely?: boolean;
  canTransmitLive?: boolean;
  voiceConfigured: boolean;
  voiceProvider?: "elevenlabs" | "google" | "openai" | null;
  queuedJobs: number;
  companies: number;
  approvedDrafts: number;
  sentDrafts: number;
  pendingDrafts: number;
  conversionsMatched?: number;
  conversionRate?: number;
  subscribedCount?: number;
  subscriptionRate?: number;
  sentInWindow?: number;
  recentSignupCount?: number;
  business?: {
    mrr: number;
    arr: number;
    pipelineMrr: number;
    payingClients: number;
    trialingClients: number;
    pastDueClients: number;
    canceledClients?: number;
    productCompanies: number;
    inspectionsTotal: number;
    communityTrialsClaimed: number;
    totalProfiles: number;
    activation?: {
      payingWithZeroInspections: number;
      signupsLast7d: number;
      inspectionsLast7d: number;
      trialBurnedUnpaid: number;
      avgInspectionsPerPaying: number;
      propertiesTotal: number;
    };
    teams?: {
      multiSeatCompanies: number;
      invitesPending: number;
      activeMembers: number;
    };
    trials?: {
      claimed: number;
      converted: number;
      stillUnpaid: number;
    };
    trust?: {
      abuseFlagged?: number;
      abuseHigh?: number;
      abuseMedium?: number;
      abuseLow?: number;
    };
    watchlistCounts?: {
      pastDue: number;
      deadPaid: number;
      trialBurned: number;
      canceled?: number;
      underBilled?: number;
    };
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
    /** Android APK bridge — TextToSpeech via MainActivity JavascriptInterface. */
    NovaNative?: {
      speak: (text: string) => void;
      stop: () => void;
    };
    __novaOnSpeakDone?: (() => void) | null;
  }
}

function isNovaApk(): boolean {
  return (
    typeof navigator !== "undefined" && /RideByNova/i.test(navigator.userAgent)
  );
}

function hasNativeTts(): boolean {
  return typeof window !== "undefined" && typeof window.NovaNative?.speak === "function";
}

/** Promise wrapper around Android TextToSpeech (window.NovaNative). */
function speakWithNative(text: string): Promise<void> {
  const native = window.NovaNative;
  if (!native?.speak) {
    return Promise.reject(new Error("Native voice bridge unavailable."));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (window.__novaOnSpeakDone === finish) {
        window.__novaOnSpeakDone = null;
      }
      resolve();
    };
    window.__novaOnSpeakDone = finish;
    try {
      native.speak(text);
    } catch (err) {
      window.__novaOnSpeakDone = null;
      reject(err instanceof Error ? err : new Error("Native voice failed"));
      return;
    }
    // Safety net so the mic session never hangs if TTS never callbacks.
    window.setTimeout(finish, Math.min(120_000, Math.max(8_000, text.length * 80)));
  });
}

function stopNativeTts() {
  try {
    window.NovaNative?.stop?.();
  } catch {
    /* ignore */
  }
}

function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Android/i.test(ua))
  );
}

/** iPhone / iPad — stricter audio gesture rules than desktop Safari. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ may report MacIntel
  return (
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  );
}

function isMobileTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    isIOS() ||
    /Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches)
  );
}

function getAudioContextClass(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

/** Cached after voiceschanged — iOS often returns [] on first getVoices(). */
let cachedSpeechVoices: SpeechSynthesisVoice[] = [];
let preferredSpeechVoice: SpeechSynthesisVoice | undefined;
let speechVoicesListening = false;

function pickPreferredVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) =>
      /daniel|serena|martha|arthur|google uk|british|en-gb/i.test(v.name)
    ) ||
    voices.find((v) => /^en-GB/i.test(v.lang)) ||
    voices.find((v) =>
      /samantha|karen|moira|victoria|susan|zira|google us english|siri/i.test(
        v.name
      )
    ) ||
    voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en"))
  );
}

function rememberSpeechVoices(voices: SpeechSynthesisVoice[]) {
  if (!voices.length) return;
  cachedSpeechVoices = voices;
  preferredSpeechVoice = pickPreferredVoice(voices) ?? preferredSpeechVoice;
}

/** Warm/cache device voices early (iOS fills these async via voiceschanged). */
function ensureSpeechVoicesWarm(synth?: SpeechSynthesis) {
  if (typeof window === "undefined") return;
  const s = synth ?? window.speechSynthesis;
  if (!s) return;
  try {
    rememberSpeechVoices(s.getVoices());
  } catch {
    /* ignore */
  }
  if (speechVoicesListening) return;
  speechVoicesListening = true;
  const onVoices = () => {
    try {
      rememberSpeechVoices(s.getVoices());
    } catch {
      /* ignore */
    }
  };
  try {
    s.addEventListener("voiceschanged", onVoices);
  } catch {
    /* ignore */
  }
}

/** Safari often returns [] until voiceschanged — poll instead of failing early. */
function waitForSpeechVoices(
  synth: SpeechSynthesis,
  maxMs = 2500
): Promise<SpeechSynthesisVoice[]> {
  ensureSpeechVoicesWarm(synth);
  const existing = synth.getVoices();
  if (existing.length > 0) {
    rememberSpeechVoices(existing);
    return Promise.resolve(existing);
  }
  if (cachedSpeechVoices.length > 0) {
    return Promise.resolve(cachedSpeechVoices);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onVoices);
      clearInterval(poll);
      clearTimeout(hardStop);
      rememberSpeechVoices(voices);
      resolve(voices.length ? voices : cachedSpeechVoices);
    };
    const onVoices = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) finish(voices);
    };
    synth.addEventListener("voiceschanged", onVoices);
    const poll = window.setInterval(() => {
      const voices = synth.getVoices();
      if (voices.length > 0) finish(voices);
    }, 120);
    const hardStop = window.setTimeout(() => finish(synth.getVoices()), maxMs);
    synth.getVoices();
  });
}

function primeSpeechSynthesis(synth: SpeechSynthesis) {
  try {
    ensureSpeechVoicesWarm(synth);
    synth.getVoices();
    synth.resume();
  } catch {
    /* ignore */
  }
}

function primeSpeechSynthesisInGesture(synth: SpeechSynthesis) {
  primeSpeechSynthesis(synth);
  // iOS: real speak() must happen in the same user gesture as playback —
  // a dummy utter can steal that gesture, so skip priming speak() there.
  if (isIOS()) return;
  try {
    const prime = new SpeechSynthesisUtterance("\u200B");
    prime.volume = 0.01;
    prime.rate = 2;
    synth.speak(prime);
  } catch {
    /* ignore */
  }
}

/**
 * Fully unlock Web Audio inside a user gesture (iOS requires this once).
 * After this, decode+start can run after awaits.
 */
function unlockAudioContextInGesture(ctx: AudioContext): void {
  try {
    void ctx.resume();
    // Tiny silent buffer — more reliable unlock than resume() alone on iOS.
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    try {
      void ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

function needsSafariGesturePlayback(): boolean {
  return isSafariBrowser() && !isNovaApk();
}

/** Mobile browsers (and Safari) often revoke speech/audio after any await. */
function needsGestureForVoice(): boolean {
  if (isNovaApk()) return false;
  return needsSafariGesturePlayback() || isMobileTouchDevice() || isIOS();
}

class NeedsGesturePlaybackError extends Error {
  constructor(message = "Safari requires a tap to play voice") {
    super(message);
    this.name = "NeedsGesturePlaybackError";
  }
}

interface PendingVoice {
  text: string;
  blob: Blob | null;
  /** Prefetched object URL — assign before tap so play() stays in-gesture. */
  url?: string;
  after: ListenMode;
  useBrowserTts: boolean;
}

interface VoiceFetchResult {
  blob: Blob | null;
  useBrowserTts: boolean;
  status: number;
  contentType: string;
  bytes: number;
  format: string;
  provider?: string;
  error?: string;
}

function formatVoiceDiag(parts: {
  unlocked?: boolean;
  status?: number;
  contentType?: string;
  bytes?: number;
  format?: string;
  path?: string;
  error?: string;
}): string {
  const bits: string[] = [];
  if (parts.unlocked !== undefined) bits.push(`unlock=${parts.unlocked ? "yes" : "no"}`);
  if (parts.status != null) bits.push(`HTTP ${parts.status}`);
  if (parts.contentType) bits.push(parts.contentType);
  if (parts.bytes != null) bits.push(`${parts.bytes}b`);
  if (parts.format) bits.push(parts.format);
  if (parts.path) bits.push(parts.path);
  if (parts.error) bits.push(parts.error);
  return bits.join(" · ");
}

/** Warm TTS provider caches / TLS after orb unlock (no audio, no credits). */
function warmSpeakPath(): void {
  void fetch("/api/nova/speak", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warmup: true }),
  }).catch(() => {
    /* ignore */
  });
}

/** Live sentence queue: chat SSE pushes; speak() pulls and TTS-overlaps. */
function createLiveSpeakQueue(): {
  push: (sentence: string) => void;
  close: () => void;
  take: () => Promise<string | null>;
} {
  const items: string[] = [];
  let closed = false;
  let wake: (() => void) | null = null;
  const notify = () => {
    const w = wake;
    wake = null;
    w?.();
  };
  return {
    push(sentence: string) {
      const s = sentence.trim();
      if (!s || closed) return;
      items.push(s);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    take() {
      return new Promise<string | null>((resolve) => {
        const tryTake = () => {
          if (items.length > 0) {
            resolve(items.shift()!);
            return;
          }
          if (closed) {
            resolve(null);
            return;
          }
          wake = tryTake;
        };
        tryTake();
      });
    },
  };
}

async function readNovaChatSse(
  res: Response,
  handlers: {
    onDelta: (text: string) => void;
    onDone: (reply: string) => void;
  }
): Promise<string> {
  if (!res.body) {
    const data = (await res.json()) as { reply?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Nova failed");
    const reply = data.reply ?? "…";
    handlers.onDone(reply);
    return reply;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalReply = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let payload: {
        type?: string;
        text?: string;
        reply?: string;
        error?: string;
      };
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        continue;
      }
      if (payload.type === "delta" && payload.text) {
        handlers.onDelta(payload.text);
      } else if (payload.type === "done") {
        finalReply = payload.reply ?? finalReply;
        handlers.onDone(finalReply);
      } else if (payload.type === "error") {
        throw new Error(payload.error ?? "Nova failed");
      }
    }
  }

  return finalReply || "…";
}

/** Fetch TTS audio; never treat JSON error bodies as MPEG. */
async function fetchVoiceAudio(
  text: string,
  signal?: AbortSignal
): Promise<VoiceFetchResult> {
  const empty: VoiceFetchResult = {
    blob: null,
    useBrowserTts: true,
    status: 0,
    contentType: "",
    bytes: 0,
    format: "",
  };

  let res: Response;
  try {
    res = await fetch("/api/nova/speak", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(isIOS() ? { "X-Nova-Mobile": "ios" } : {}),
      },
      // Prefer MPEG for latency (smaller). iOS AudioContext decodes mp3 fine.
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) {
      return { ...empty, error: "aborted" };
    }
    return {
      ...empty,
      error: err instanceof Error ? err.message : "network failed",
    };
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const format =
    res.headers.get("x-nova-format") ??
    (contentType.includes("wav") ? "wav" : contentType.includes("mpeg") ? "mpeg" : "");
  const provider = res.headers.get("x-nova-voice") ?? undefined;

  if (res.status === 401) {
    let reason = "auth denied";
    try {
      const data = (await res.json()) as { error?: string; reason?: string };
      reason = data.reason ?? data.error ?? reason;
    } catch {
      /* ignore */
    }
    return {
      ...empty,
      status: 401,
      contentType,
      format,
      provider,
      useBrowserTts: true,
      error: `401 ${reason}: sign in on this device`,
    };
  }

  if (res.status === 503) {
    try {
      const data = (await res.json()) as { code?: string; error?: string };
      if (data.code === "FALLBACK_BROWSER" || !data.code) {
        return {
          ...empty,
          status: 503,
          contentType: "application/json",
          format: "browser-tts",
          provider,
          useBrowserTts: true,
          error:
            data.error ||
            "Server TTS unavailable. Using free device voice.",
        };
      }
      return {
        ...empty,
        status: 503,
        contentType: "application/json",
        format: "",
        provider,
        useBrowserTts: false,
        error: data.error ?? "Voice API unavailable",
      };
    } catch {
      return { ...empty, status: 503, useBrowserTts: true, error: "503 fallback" };
    }
  }

  if (!res.ok) {
    return {
      ...empty,
      status: res.status,
      contentType,
      format,
      provider,
      useBrowserTts: true,
      error: `speak HTTP ${res.status}`,
    };
  }

  if (contentType.includes("json")) {
    try {
      const data = (await res.json()) as { error?: string };
      return {
        ...empty,
        status: res.status,
        contentType,
        provider,
        useBrowserTts: true,
        error: data.error ?? "speak returned JSON",
      };
    } catch {
      return {
        ...empty,
        status: res.status,
        contentType,
        provider,
        useBrowserTts: true,
        error: "speak returned JSON",
      };
    }
  }

  const blob = await res.blob();
  if (!blob.size) {
    return {
      ...empty,
      status: res.status,
      contentType: blob.type || contentType,
      format,
      provider,
      useBrowserTts: true,
      error: "empty audio blob",
    };
  }

  if (blob.type.includes("json")) {
    return {
      ...empty,
      status: res.status,
      contentType: blob.type,
      format,
      provider,
      useBrowserTts: true,
      error: "blob is JSON not audio",
    };
  }

  const normalized = normalizeAudioBlob(blob, format);
  return {
    blob: normalized,
    useBrowserTts: false,
    status: res.status,
    contentType: normalized.type || contentType,
    bytes: normalized.size,
    format: format || normalized.type,
    provider,
  };
}

/**
 * Safari/iOS: call speak() synchronously — no await before speak in this function.
 * Must be invoked at the top of a tap/pointer handler (before killMic / fetch).
 */
function speakWithFreeVoiceSync(text: string): Promise<void> {
  const clipped = text.trim().slice(0, 2500);
  if (!clipped) return Promise.resolve();

  if (isNovaApk() && hasNativeTts()) {
    return speakWithNative(clipped);
  }

  if (typeof window === "undefined" || !window.speechSynthesis) {
    if (hasNativeTts()) return speakWithNative(clipped);
    return Promise.reject(new Error("This browser has no free device voice."));
  }

  const synth = window.speechSynthesis;
  ensureSpeechVoicesWarm(synth);

  // Build utterance BEFORE cancel/speak so speak() is the last sync call in-gesture.
  const utterance = new SpeechSynthesisUtterance(clipped);
  utterance.lang = "en-GB";
  utterance.rate = 1.0;
  utterance.pitch = 1.05;
  utterance.volume = 1;

  const voices =
    synth.getVoices().length > 0 ? synth.getVoices() : cachedSpeechVoices;
  const preferred =
    preferredSpeechVoice || pickPreferredVoice(voices) || voices[0];
  if (preferred) {
    utterance.voice = preferred;
    if (preferred.lang) utterance.lang = preferred.lang;
  }

  return new Promise<void>((resolve, reject) => {
    let spoke = false;
    let settled = false;
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      if (ok) resolve();
      else reject(err ?? new Error("Device voice failed"));
    };

    const watchdog = window.setTimeout(
      () => {
        if (!spoke && !synth.speaking && !synth.pending) {
          finish(
            false,
            new Error(
              voices.length === 0
                ? "Device voices not loaded — tap orb again"
                : "Device voice did not start (check Silent switch / media volume)"
            )
          );
        }
      },
      isIOS() ? 4500 : 3000
    );

    utterance.onstart = () => {
      spoke = true;
    };
    utterance.onend = () => finish(true);
    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") {
        finish(true);
        return;
      }
      finish(false, new Error(event.error || "Device voice failed"));
    };

    try {
      synth.cancel();
      synth.resume();
    } catch {
      /* ignore */
    }

    // THE critical line — must remain synchronous in the user-gesture stack.
    synth.speak(utterance);

    // iOS WebKit often won't start until pause/resume after speak().
    if (isIOS() || isSafariBrowser()) {
      try {
        synth.pause();
        synth.resume();
      } catch {
        /* ignore */
      }
    }
  });
}

function normalizeAudioBlob(blob: Blob, formatHint?: string): Blob {
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  const type = formatHint?.includes("wav")
    ? "audio/wav"
    : isIOS()
      ? "audio/wav"
      : "audio/mpeg";
  return new Blob([blob], { type });
}

/**
 * Play TTS via a previously-resumed AudioContext.
 * After the user taps once (orb/mic/send), iOS allows buffer playback without
 * another gesture — unlike speechSynthesis and often more reliable than <audio>.
 */
function playBlobViaAudioContext(
  ctx: AudioContext,
  blob: Blob,
  opts?: {
    onSource?: (source: AudioBufferSourceNode) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  return (async () => {
    if (opts?.signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const ab = await blob.arrayBuffer();
    const copy = ab.slice(0);
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      let settled = false;
      const ok = (buf: AudioBuffer) => {
        if (settled) return;
        settled = true;
        resolve(buf);
      };
      const fail = (err?: unknown) => {
        if (settled) return;
        settled = true;
        reject(
          err instanceof Error ? err : new Error("decodeAudioData failed")
        );
      };
      try {
        const maybe = ctx.decodeAudioData(copy, ok, fail) as
          | Promise<AudioBuffer>
          | undefined;
        if (maybe && typeof maybe.then === "function") {
          maybe.then(ok, fail);
        }
      } catch (err) {
        fail(err);
      }
    });

    if (opts?.signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        opts?.onSource?.(source);
        const onAbort = () => {
          try {
            source.stop(0);
          } catch {
            /* ignore */
          }
          resolve();
        };
        opts?.signal?.addEventListener("abort", onAbort, { once: true });
        source.onended = () => {
          opts?.signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        source.start(0);
      } catch (err) {
        reject(
          err instanceof Error ? err : new Error("AudioContext play failed")
        );
      }
    });
  })();
}

/**
 * Play MPEG/WAV on the persistent unlocked <audio> element.
 * Works post-fetch on Safari once the element was warmed in a prior user gesture.
 */
function playBlobOnElement(
  el: HTMLAudioElement,
  blob: Blob,
  objectUrlRef: { current: string | null }
): Promise<void> {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  const typed = normalizeAudioBlob(blob);
  const url = URL.createObjectURL(typed);
  objectUrlRef.current = url;

  el.muted = false;
  el.volume = 1;
  primeAudioElement(el);
  el.src = url;
  el.load();

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;

    const cleanup = () => {
      el.onended = null;
      el.onerror = null;
      el.onloadedmetadata = null;
      el.oncanplaythrough = null;
      el.onplaying = null;
      window.clearTimeout(watchdog);
    };

    const finish = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (ok) resolve();
      else reject(err ?? new Error("Voice playback failed"));
    };

    el.onloadedmetadata = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d < 0.05) {
        finish(false, new Error("Voice file has zero duration"));
      }
    };

    el.onplaying = () => {
      started = true;
    };

    el.onended = () => {
      if (objectUrlRef.current === url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      if (!started) {
        finish(false, new Error("Voice ended without playing"));
        return;
      }
      finish(true);
    };

    el.onerror = () => {
      if (objectUrlRef.current === url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      finish(false, new Error("Browser could not play the voice file"));
    };

    const attemptPlay = (retriesLeft: number) => {
      // Speakers / A2DP: never leave the element muted or at 0 after mic release.
      el.muted = false;
      el.volume = 1;
      void el.play().catch(async (err: unknown) => {
        if (retriesLeft > 0) {
          await new Promise((r) => window.setTimeout(r, 150));
          attemptPlay(retriesLeft - 1);
          return;
        }
        const msg = err instanceof Error ? err.message : "play blocked";
        finish(false, new Error(msg));
      });
    };

    const startPlayback = () => {
      if (settled) return;
      attemptPlay(1);
    };

    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
    } else {
      el.oncanplaythrough = () => startPlayback();
    }

    const watchdog = window.setTimeout(() => {
      if (settled) return;
      if (!started && (el.paused || el.currentTime < 0.01)) {
        finish(false, new Error("Voice did not start"));
      }
    }, 1500);
  });
}

function primeAudioElement(el: HTMLAudioElement) {
  el.muted = false;
  el.volume = 1;
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.setAttribute("x-webkit-airplay", "allow");
  (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  el.controls = false;
}

/**
 * Tap-handler path when src is already set (prefetched).
 * play() MUST run synchronously in the pointer/touch handler — no await before it.
 */
function playPreparedInGesture(
  el: HTMLAudioElement,
  objectUrlRef: { current: string | null }
): Promise<void> {
  el.muted = false;
  el.volume = 1;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      el.onended = null;
      el.onerror = null;
      el.onloadedmetadata = null;
      el.onplaying = null;
      window.clearTimeout(watchdog);
      if (ok) resolve();
      else reject(err ?? new Error("Voice playback failed"));
    };

    el.onloadedmetadata = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d < 0.05) {
        finish(false, new Error("Voice file has zero duration"));
      }
    };
    el.onplaying = () => {
      started = true;
    };
    el.onended = () => {
      const url = objectUrlRef.current;
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      if (!started) {
        finish(false, new Error("Voice ended without playing"));
        return;
      }
      finish(true);
    };
    el.onerror = () => {
      const url = objectUrlRef.current;
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      finish(false, new Error("Browser could not play the voice file"));
    };

    const playResult = el.play();
    if (playResult !== undefined) {
      playResult.catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "play blocked";
        finish(false, new Error(msg));
      });
    }

    const watchdog = window.setTimeout(() => {
      if (settled) return;
      if (!started && (el.paused || el.currentTime < 0.01)) {
        finish(false, new Error("Voice did not start"));
      }
    }, isIOS() ? 4000 : 2000);
  });
}

/** Tap-handler path: assign src and play() in the same synchronous turn. */
function playBlobInGesture(
  el: HTMLAudioElement,
  blob: Blob,
  objectUrlRef: { current: string | null }
): Promise<void> {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  const typed = normalizeAudioBlob(blob);
  const url = URL.createObjectURL(typed);
  objectUrlRef.current = url;

  primeAudioElement(el);
  el.src = url;

  return playPreparedInGesture(el, objectUrlRef);
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

function stripWake(text: string): string {
  return text.replace(/^(hey\s+)?nova[,.\s!]*/i, "").trim();
}

function containsWake(text: string): boolean {
  return /\bhey\s+nova\b/i.test(text) || /\bnova\b/i.test(text);
}

/** Normalize for intent matching. */
function normalizeUtterance(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ");
}

/** True when the utterance is only the wake word (no real command yet). */
function isWakeOnly(text: string): boolean {
  const rest = stripWake(text);
  if (rest.length >= 2) return false;
  return /^(hey )?nova$/.test(normalizeUtterance(text));
}

/** User is ending the conversation — Nova should stop active listening. */
function isCloseIntent(text: string): boolean {
  const t = normalizeUtterance(stripWake(text) || text);
  if (!t) return false;
  if (
    /^(stop|sleep|bye|goodbye|thanks|thank you|never mind|cancel|done|quit)$/.test(
      t
    )
  ) {
    return true;
  }
  return /\b(stop listening|go to sleep|that'?s all|never mind|good ?bye|talk later|we'?re done|nothing else|catch you later|thanks nova|thank you nova)\b/.test(
    t
  );
}

/**
 * Intentional speech worth treating as a request once Nova is awake.
 * Filters filler so ambient mutter doesn't spam commands mid-chat.
 */
function looksLikeCommand(text: string): boolean {
  const raw = stripWake(text) || text.trim();
  const t = normalizeUtterance(raw);
  if (t.length < 3) return false;
  if (isWakeOnly(text) || isCloseIntent(text)) return false;
  if (
    /^(um+|uh+|hmm+|ah+|oh+|okay|ok|yeah|yep|yup|nope|nah|huh|mhm+|mm+)$/.test(
      t
    )
  ) {
    return false;
  }
  // Prefer multi-word asks, or a single solid word (≥5 chars).
  const words = t.split(" ").filter(Boolean);
  if (words.length >= 2) return true;
  return t.length >= 5;
}

/** How long Nova waits after the last speech before ending the open listen. */
const SILENCE_END_MS = 5500;
/** Ignore duplicate / overlapping mic finals within this window (same turn). */
const UTTERANCE_DEDUPE_MS = 2500;

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.09);
  } catch {
    /* ignore */
  }
}

function readListenIntentFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const listen = params.get("listen");
    if (listen === "1" || listen === "true") return true;
    const hash = window.location.hash.replace(/^#/, "").toLowerCase();
    return hash === "listen" || hash === "listen=1" || hash.startsWith("listen&");
  } catch {
    return false;
  }
}

/** Shortcut Dictate Text (or typed) utterance from ?q= — process without waiting on mic. */
function readQueryUtteranceFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return null;
    const trimmed = q.trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

function stripQueryParamFromUrl(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(key)) return;
    url.searchParams.delete(key);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}

/**
 * Mic permission often persists after a prior Safari grant. Recognition can start
 * without a tap even when HTMLAudioElement autoplay cannot. Prefer starting the
 * mic; treat "denied" as the only hard stop.
 */
async function probeMicrophoneAccess(): Promise<"granted" | "denied" | "unknown"> {
  try {
    const perms = navigator.permissions;
    if (perms?.query) {
      const status = await perms.query({
        name: "microphone" as PermissionName,
      });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
    }
  } catch {
    /* Safari / WebKit may reject Permissions API for microphone */
  }
  return "unknown";
}

/** iOS Bluetooth SCO needs a beat after capture dies before TTS can use A2DP/speakers. */
function micSettleMsForDevice(): number {
  return isIOS() || isMobileTouchDevice() ? 220 : 120;
}

function disableMediaStreamTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getAudioTracks()) {
    try {
      track.enabled = false;
    } catch {
      /* ignore */
    }
  }
}

/** Full release — disables then stops tracks so iOS can leave headset-SCO routing. */
function stopMediaStreamTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.enabled = false;
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

function mediaStreamIsLive(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getAudioTracks().some((t) => t.readyState === "live");
}

export function NovaConsole({ autoListen = false }: { autoListen?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);
  const [listeningOn, setListeningOn] = useState(true);
  const [, setNeedsGesture] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  /** Opened via Siri Shortcut / ?listen=1 — skip wake phrase. */
  const [shortcutListen, setShortcutListen] = useState(autoListen);
  /**
   * Optional recovery only (never the primary glasses path).
   * Shortcut / ?listen=1 must not soft-lock behind a full-screen tap wall.
   */
  const [listenTapNeeded, setListenTapNeeded] = useState(false);
  const [voicePathLabel, setVoicePathLabel] = useState<string | null>(null);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    })
  );
  /** Internal voice path breadcrumbs (not shown in UI). */
  const voiceDebugRef = useRef<string | null>(null);
  const setVoiceDebug = (value: string | null) => {
    voiceDebugRef.current = value;
  };
  const [telemetry, setTelemetry] = useState<{
    mrr: number[];
    inspect7: number[];
    convert: number[];
    queued: number[];
  }>({ mrr: [], inspect7: [], convert: [], queued: [] });

  const phaseRef = useRef<Phase>("idle");
  const listeningOnRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /**
   * Owned getUserMedia stream — SpeechRecognition alone does not expose tracks.
   * We mute/stop these before TTS so iOS can leave Bluetooth SCO and play aloud.
   */
  const captureStreamRef = useRef<MediaStream | null>(null);
  const restartingRef = useRef(false);
  const commandBufferRef = useRef("");
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const speakAbortRef = useRef<AbortController | null>(null);
  const speakWarmRef = useRef(false);
  const liveSpeakQueueRef = useRef<{ close: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingVoiceRef = useRef<PendingVoice | null>(null);
  const waitingForTapRef = useRef(false);
  const gesturePlayLockRef = useRef(false);
  const unlockInFlightRef = useRef(false);
  /** Orb tap drained pending voice — skip mute toggle on the following click. */
  const drainedPendingRef = useRef(false);
  const playPendingNowRef = useRef<() => void>(() => {});
  /** After TTS, restart mic in wake (dormant) or command (open) mode. */
  const resumeModeRef = useRef<ListenMode>("command");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  /** Monotonic id so a newer ask can supersede an in-flight chat/speak. */
  const chatSeqRef = useRef(0);
  const chatAbortRef = useRef<AbortController | null>(null);
  /** True from mic commit / ask start until that turn finishes (or is superseded). */
  const askInFlightRef = useRef(false);
  /** Sync re-entry guard — blocks double finals before askNova flips phase. */
  const micCommitLockRef = useRef(false);
  /** Last mic-committed utterance for short-window dedupe. */
  const lastMicCommitRef = useRef<{ norm: string; at: number } | null>(null);
  /** Bumped when output is interrupted so a stale speak() bails cleanly. */
  const outputEpochRef = useRef(0);
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const openConversationRef = useRef<() => void>(() => {});
  const goDormantRef = useRef<() => void>(() => {});
  const speakRef = useRef<
    (
      input: string | { take: () => Promise<string | null> },
      after?: ListenMode,
      fullTextForFallback?: string,
      opts?: { skipTapRecovery?: boolean }
    ) => Promise<void>
  >(async () => {});
  const autoListenRef = useRef(autoListen);
  const listenTapNeededRef = useRef(false);
  /** Prevents overlapping unlock→listen boots. */
  const listenReadyInFlightRef = useRef(false);
  const runListenReadySequenceRef = useRef<
    (fromGesture: boolean) => Promise<void>
  >(async () => {});

  /**
   * Resume/create AudioContext only — safe during pending playback.
   * Does not touch <audio> src (silent WAV can kill speechSynthesis on iOS).
   */
  const resumeAudioContextInGesture = useCallback((): boolean => {
    try {
      const AC = getAudioContextClass();
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        unlockAudioContextInGesture(audioCtxRef.current);
      }
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (synth) primeSpeechSynthesis(synth);
      audioUnlockedRef.current = true;
      unlockInFlightRef.current = false;
      setAudioUnlocked(true);
      setNeedsGesture(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const unlockAudioInGesture = useCallback((): boolean => {
    const el = audioElRef.current;
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;
    const wasUnlocked = audioUnlockedRef.current;

    try {
      resumeAudioContextInGesture();

      if (el) {
        primeAudioElement(el);
        el.muted = false;
        el.volume = 1;
        const hasVoiceSrc =
          Boolean(objectUrlRef.current) &&
          (el.src === objectUrlRef.current ||
            el.currentSrc === objectUrlRef.current ||
            (pendingVoiceRef.current?.url != null &&
              (el.src === pendingVoiceRef.current.url ||
                el.currentSrc === pendingVoiceRef.current.url)));
        const speakingNow =
          phaseRef.current === "speaking" &&
          !el.paused &&
          el.currentTime > 0 &&
          !el.ended;
        const synthBusy =
          typeof window !== "undefined" &&
          Boolean(
            window.speechSynthesis?.speaking || window.speechSynthesis?.pending
          );

        // One-time <audio> warm-up only — never while voice is queued/playing.
        // On iOS, silent WAV after speechSynthesis.speak() steals the session.
        if (
          !wasUnlocked &&
          !hasVoiceSrc &&
          !speakingNow &&
          !synthBusy &&
          !waitingForTapRef.current
        ) {
          el.src = SILENT_WAV;
          void el.play().then(() => {
            try {
              el.pause();
              el.currentTime = 0;
            } catch {
              /* ignore */
            }
          });
        }
      }

      if (synth) primeSpeechSynthesisInGesture(synth);

      audioUnlockedRef.current = true;
      unlockInFlightRef.current = false;
      setAudioUnlocked(true);
      setNeedsGesture(false);
      setVoiceDebug(
        formatVoiceDiag({ unlocked: true, path: "unlock:gesture" })
      );
      // Warm /api/nova/speak path once so the first real reply isn't cold.
      if (!speakWarmRef.current) {
        speakWarmRef.current = true;
        warmSpeakPath();
      }
      return true;
    } catch {
      unlockInFlightRef.current = false;
      setNeedsGesture(true);
      setAudioUnlocked(false);
      setVoiceDebug(formatVoiceDiag({ unlocked: false, path: "unlock:failed" }));
      return false;
    }
  }, [resumeAudioContextInGesture]);

  /**
   * Best-effort unlock outside a tap. Must NOT claim success on iOS when
   * AudioContext stays suspended — that made greeting autoplay "succeed" the
   * unlock check, fail playback, and leave mic/listen in a broken state.
   */
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (audioUnlockedRef.current) {
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (synth) primeSpeechSynthesis(synth);
      setAudioUnlocked(true);
      return true;
    }

    try {
      const AC = getAudioContextClass();
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        unlockAudioContextInGesture(audioCtxRef.current);
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      }
    } catch {
      /* ignore */
    }

    const el = audioElRef.current;
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;
    const ctxRunning =
      Boolean(audioCtxRef.current) &&
      audioCtxRef.current!.state === "running";

    if (!el) {
      if (ctxRunning) {
        audioUnlockedRef.current = true;
        setAudioUnlocked(true);
        setNeedsGesture(false);
        if (synth) {
          primeSpeechSynthesis(synth);
          void waitForSpeechVoices(synth, isSafariBrowser() ? 3000 : 1200);
        }
        return true;
      }
      setNeedsGesture(true);
      setAudioUnlocked(false);
      return false;
    }

    try {
      primeAudioElement(el);
      el.muted = true;
      el.src = SILENT_WAV;
      await el.play();
      el.pause();
      el.muted = false;
      el.removeAttribute("src");
      el.load();
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      setNeedsGesture(false);
      if (synth) {
        primeSpeechSynthesisInGesture(synth);
        void waitForSpeechVoices(synth, isSafariBrowser() ? 3000 : 1200);
      }
      return true;
    } catch {
      el.muted = false;
      if (ctxRunning || audioCtxRef.current?.state === "running") {
        audioUnlockedRef.current = true;
        setAudioUnlocked(true);
        setNeedsGesture(false);
        return true;
      }
      setNeedsGesture(true);
      setAudioUnlocked(false);
      return false;
    }
  }, []);

  /**
   * Free device TTS when ElevenLabs is missing or out of credits.
   * On Safari after async work, throws — use speakWithFreeVoiceSync in a tap handler.
   */
  const speakWithFreeVoice = useCallback(async (text: string) => {
    // After any await (fetch), mobile/Safari will not start Web Speech without a tap.
    if (needsGestureForVoice()) {
      throw new NeedsGesturePlaybackError(
        "Tap to hear — device voice needs a tap after each reply"
      );
    }

    const clipped = text.trim().slice(0, 2500);
    if (!clipped) return;

    const preferNative =
      isNovaApk() ||
      typeof window === "undefined" ||
      !window.speechSynthesis;

    if (preferNative && hasNativeTts()) {
      await speakWithNative(clipped);
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (hasNativeTts()) {
        await speakWithNative(clipped);
        return;
      }
      throw new Error("This browser has no free device voice.");
    }

    await waitForSpeechVoices(
      window.speechSynthesis,
      isSafariBrowser() ? 3000 : 900
    );

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0 && hasNativeTts()) {
      await speakWithNative(clipped);
      return;
    }

    if (voices.length === 0) {
      throw new Error("No device voices loaded yet — tap the orb, then try again.");
    }

    await speakWithFreeVoiceSync(clipped);
  }, []);

  const resumeAfterSpeech = useCallback((mode: ListenMode) => {
    const next: Phase =
      mode === "command" ? "listening_command" : "listening_wake";
    // Sync ref immediately so startMic (after settle) doesn't bail on stale "speaking".
    phaseRef.current = next;
    setPhase(next);
    // Brief gap after TTS ended so the audio session can flip back to capture.
    const resumeDelay = isIOS() || isMobileTouchDevice() ? 400 : 350;
    window.setTimeout(() => {
      if (!listeningOnRef.current) return;
      if (phaseRef.current === "speaking" || phaseRef.current === "thinking") {
        return;
      }
      startMicRef.current(mode);
    }, resumeDelay);
  }, []);

  useEffect(() => {
    // iOS loads speechSynthesis voices asynchronously — cache ASAP.
    if (typeof window !== "undefined" && window.speechSynthesis) {
      ensureSpeechVoicesWarm(window.speechSynthesis);
    }
  }, []);

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    primeAudioElement(el);
    el.preload = "auto";
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    listeningOnRef.current = listeningOn;
  }, [listeningOn]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, phase]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/nova/status", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
      const seeded = data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      if (seeded.length && lines.length === 0) setLines(seeded);
    } catch {
      /* ignore */
    }
  }, [lines.length]);

  useEffect(() => {
    void refreshStatus();
    const poll = window.setInterval(() => void refreshStatus(), 45000);
    return () => window.clearInterval(poll);
  }, [refreshStatus]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/New_York",
        })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!status) return;
    const mrr = status.business?.mrr ?? 0;
    const inspect7 = status.business?.activation?.inspectionsLast7d ?? 0;
    const convert = status.conversionRate ?? 0;
    const queued = status.queuedJobs ?? 0;
    setTelemetry((prev) => {
      const lastSame =
        prev.mrr[prev.mrr.length - 1] === mrr &&
        prev.inspect7[prev.inspect7.length - 1] === inspect7 &&
        prev.convert[prev.convert.length - 1] === convert &&
        prev.queued[prev.queued.length - 1] === queued;
      if (lastSame && prev.mrr.length > 0) return prev;
      const push = (arr: number[], v: number) => [...arr, v].slice(-24);
      return {
        mrr: push(prev.mrr, mrr),
        inspect7: push(prev.inspect7, inspect7),
        convert: push(prev.convert, convert),
        queued: push(prev.queued, queued),
      };
    });
  }, [status]);

  /**
   * Hard-kill mic capture for duplex TTS.
   * 1) Stop SpeechRecognition completely (abort + stop)
   * 2) Disable then stop owned getUserMedia tracks (releases Bluetooth SCO)
   * Chrome will not reliably restart a stopped recognition instance.
   */
  const killMic = useCallback((opts?: { keepSpeech?: boolean }) => {
    restartingRef.current = true;
    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = null;
    }
    stopNativeTts();
    if (!opts?.keepSpeech) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      // Abort + stop: some WebViews keep the capture session after abort alone.
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    // Hard-mute MediaStream tracks, then stop them so iOS can leave SCO.
    const stream = captureStreamRef.current;
    captureStreamRef.current = null;
    disableMediaStreamTracks(stream);
    stopMediaStreamTracks(stream);
    window.setTimeout(() => {
      restartingRef.current = false;
    }, 100);
  }, []);

  /**
   * Duplex fix: recognition + MediaStream tracks must release BEFORE any TTS
   * play(). Abort alone was not enough on glasses/iPhone — open capture holds
   * Bluetooth SCO and ducks/blocks speaker TTS until the user mutes.
   * Sync kill first; longer settle lets WebKit tear down the audio session.
   */
  const pauseMicForSpeech = useCallback(
    (opts?: { settleMs?: number }): Promise<void> => {
      phaseRef.current = "speaking";
      setPhase("speaking");
      killMic({ keepSpeech: true });
      const settleMs = opts?.settleMs ?? micSettleMsForDevice();
      if (settleMs <= 0) return Promise.resolve();
      return new Promise((resolve) => {
        window.setTimeout(resolve, settleMs);
      });
    },
    [killMic]
  );

  const prefetchVoiceUrl = useCallback((blob: Blob, formatHint?: string): string => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(normalizeAudioBlob(blob, formatHint));
    objectUrlRef.current = url;
    const el = audioElRef.current;
    if (el) {
      primeAudioElement(el);
      el.src = url;
      el.load();
    }
    return url;
  }, []);

  /**
   * Any intentional tap (orb / mic / send / page): unlock audio for the session
   * and immediately play a queued reply if one is waiting (device-TTS / blocked play).
   *
   * Duplex: pause mic before playPendingNow so capture cannot hold the session.
   */
  const handleUserGesture = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.stopPropagation();
      const pending = pendingVoiceRef.current;
      if (waitingForTapRef.current && pending) {
        // MPEG/WAV: resume AC first (helps AudioContext fallback paths).
        // Device TTS: do NOTHING before speak() — even a silent buffer can
        // consume the iOS user-gesture token and leave speechSynthesis mute.
        if (pending.blob && !pending.useBrowserTts) {
          resumeAudioContextInGesture();
        }
        playPendingNowRef.current();
        return true;
      }
      unlockAudioInGesture();
      // Shortcut / listen=1: ensure command listen after unlock.
      if (
        autoListenRef.current &&
        (listenTapNeededRef.current ||
          phaseRef.current === "idle" ||
          (phaseRef.current === "listening_wake" && !recognitionRef.current) ||
          (phaseRef.current === "listening_command" && !recognitionRef.current))
      ) {
        void runListenReadySequenceRef.current(true);
        return true;
      }
      return false;
    },
    [resumeAudioContextInGesture, unlockAudioInGesture]
  );

  /** Orb-only: same unlock/drain, but suppress the following click mute-toggle. */
  const handleOrbGesture = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      const drained = handleUserGesture(e);
      if (drained) drainedPendingRef.current = true;
    },
    [handleUserGesture]
  );

  /**
   * Invisible recovery only — never show "reply ready / tap orb".
   * Next natural orb/mic/send gesture drains playback.
   */
  const queueSilentRecovery = useCallback(
    (pending: PendingVoice, diag?: VoiceFetchResult) => {
      if (pending.blob && !pending.useBrowserTts) {
        pending.url = prefetchVoiceUrl(pending.blob, diag?.format);
      }
      pendingVoiceRef.current = pending;
      waitingForTapRef.current = true;
      const provider = diag?.provider;
      setVoicePathLabel(
        provider === "openai"
          ? "OpenAI voice"
          : provider === "google"
            ? "Google British"
            : provider === "elevenlabs"
              ? "ElevenLabs"
              : pending.useBrowserTts
                ? "Device voice"
                : null
      );
      setVoiceDebug(
        formatVoiceDiag({
          unlocked: audioUnlockedRef.current,
          status: diag?.status,
          contentType: diag?.contentType,
          bytes: diag?.bytes,
          format: diag?.format,
          path: "silent-recovery",
          error: diag?.error,
        })
      );
    },
    [prefetchVoiceUrl]
  );

  /**
   * Tap recovery: pause mic FIRST (duplex), then speak()/play() in-gesture.
   * setState stays after play() so React work cannot steal the gesture token.
   */
  const playPendingNow = useCallback(() => {
    if (gesturePlayLockRef.current) return;
    const pending = pendingVoiceRef.current;
    const el = audioElRef.current;
    if (!pending) {
      setVoiceDebug(formatVoiceDiag({ path: "tap", error: "nothing pending" }));
      return;
    }
    // Device TTS does not need the <audio> element; MPEG/WAV does.
    if (!el && pending.blob && !pending.useBrowserTts) {
      setVoiceDebug(formatVoiceDiag({ path: "tap", error: "no audio element" }));
      return;
    }

    gesturePlayLockRef.current = true;

    const snapshot: PendingVoice = { ...pending };
    // Clear queue refs synchronously before speak so a second touch/pointer
    // event in the same tap cannot double-drain.
    pendingVoiceRef.current = null;
    waitingForTapRef.current = false;
    audioUnlockedRef.current = true;

    // 1) Hard mute BEFORE play — open mic (SCO) blocks/delays TTS on glasses.
    phaseRef.current = "speaking";
    setPhase("speaking");
    killMic({ keepSpeech: true });

    let playback: Promise<void>;
    let path = "tap";

    // 2) Kick off playback — still inside the user-gesture stack.
    try {
      if (snapshot.blob && !snapshot.useBrowserTts && el) {
        const srcReady =
          Boolean(snapshot.url) &&
          Boolean(el.src) &&
          (el.src === snapshot.url || el.currentSrc === snapshot.url);
        if (srcReady) {
          primeAudioElement(el);
          el.muted = false;
          el.volume = 1;
          path = "tap:mpeg-prepared";
          playback = playPreparedInGesture(el, objectUrlRef);
        } else {
          path = "tap:mpeg-rebind";
          playback = playBlobInGesture(el, snapshot.blob, objectUrlRef);
          snapshot.url = objectUrlRef.current ?? snapshot.url;
        }
      } else if (isNovaApk() && hasNativeTts()) {
        path = "tap:native";
        playback = speakWithNative(snapshot.text);
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
        path = "tap:device-tts";
        playback = speakWithFreeVoiceSync(snapshot.text);
      } else if (hasNativeTts()) {
        path = "tap:native";
        playback = speakWithNative(snapshot.text);
      } else {
        gesturePlayLockRef.current = false;
        pendingVoiceRef.current = snapshot;
        waitingForTapRef.current = true;
        setVoiceDebug(formatVoiceDiag({ path: "tap", error: "no playback path" }));
        return;
      }
    } catch (err) {
      gesturePlayLockRef.current = false;
      pendingVoiceRef.current = snapshot;
      waitingForTapRef.current = true;
      const msg = err instanceof Error ? err.message : "speak failed";
      setVoiceDebug(formatVoiceDiag({ path: "tap:throw", error: msg }));
      return;
    }

    // 3) UI updates only AFTER speak()/play() has been invoked.
    setPhase("speaking");
    setAudioUnlocked(true);
    setNeedsGesture(false);
    setVoiceDebug(formatVoiceDiag({ unlocked: true, path }));

    void playback
      .then(() => {
        setVoiceDebug(formatVoiceDiag({ unlocked: true, path: `${path}:ok` }));
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "play failed";
        setVoiceDebug(
          formatVoiceDiag({
            unlocked: audioUnlockedRef.current,
            path: `${path}:fail`,
            error: msg,
          })
        );
        // Quiet retry path: keep pending for next natural gesture — no CTA.
        pendingVoiceRef.current = snapshot;
        waitingForTapRef.current = true;
      })
      .finally(() => {
        gesturePlayLockRef.current = false;
        resumeAfterSpeech(snapshot.after);
      });
  }, [killMic, resumeAfterSpeech]);

  useEffect(() => {
    playPendingNowRef.current = playPendingNow;
  }, [playPendingNow]);

  const clearSilenceEnd = useCallback(() => {
    if (silenceEndRef.current) {
      clearTimeout(silenceEndRef.current);
      silenceEndRef.current = null;
    }
  }, []);

  /** Nova decides the conversation paused — drop back to dormant listen. */
  const armSilenceEnd = useCallback(() => {
    clearSilenceEnd();
    silenceEndRef.current = setTimeout(() => {
      if (phaseRef.current !== "listening_command") return;
      // Still assembling an utterance — wait again.
      if (commandBufferRef.current.trim()) {
        armSilenceEnd();
        return;
      }
      goDormantRef.current();
    }, SILENCE_END_MS);
  }, [clearSilenceEnd]);

  /**
   * Shortcut / ?listen=1: open → short delay → startMic.
   * No greeting TTS. No tap wall. Optional ?q= runs immediately.
   */
  const runListenReadySequence = useCallback(
    async (fromGesture: boolean) => {
      if (listenReadyInFlightRef.current) return;
      listenReadyInFlightRef.current = true;
      autoListenRef.current = true;
      setShortcutListen(true);
      listeningOnRef.current = true;
      setListeningOn(true);
      listenTapNeededRef.current = false;
      setListenTapNeeded(false);

      const armCommandListen = () => {
        if (phaseRef.current === "speaking" || phaseRef.current === "thinking") {
          return;
        }
        phaseRef.current = "listening_command";
        setPhase("listening_command");
        armSilenceEnd();
        if (!recognitionRef.current) startMicRef.current("command");
      };

      try {
        if (fromGesture) {
          unlockAudioInGesture();
          armCommandListen();
          return;
        }

        const initialQ = readQueryUtteranceFromLocation();
        if (initialQ) {
          // DictateText supplied the command — process immediately (mic off).
          stripQueryParamFromUrl("q");
          phaseRef.current = "thinking";
          setPhase("thinking");
          killMic();
          void unlockAudio();
          void askNovaRef.current(initialQ);
          return;
        }

        const micAccess = await probeMicrophoneAccess();
        if (micAccess === "denied") {
          setError(
            "Microphone is blocked for this site. Enable it in Safari Settings, then reopen Hey Nova from the Shortcut."
          );
          phaseRef.current = "idle";
          setPhase("idle");
          return;
        }

        // Best-effort unlock; never block mic on failed audio unlock.
        void unlockAudio();
        // Brief settle after page open, then listen for commands.
        await new Promise((r) => window.setTimeout(r, 280));
        if (!listeningOnRef.current) return;
        if (phaseRef.current === "speaking" || phaseRef.current === "thinking") {
          return;
        }
        armCommandListen();
      } finally {
        listenReadyInFlightRef.current = false;
      }
    },
    [armSilenceEnd, killMic, unlockAudio, unlockAudioInGesture]
  );

  useEffect(() => {
    runListenReadySequenceRef.current = runListenReadySequence;
  }, [runListenReadySequence]);

  const startMic = useCallback(
    (mode: ListenMode = "wake") => {
      if (!listeningOnRef.current) return;
      // NEVER open capture while thinking or speaking — holds Bluetooth SCO and
      // stalls TTS until the user mutes. Mic returns only via resumeAfterSpeech.
      if (
        phaseRef.current === "speaking" ||
        phaseRef.current === "thinking"
      ) {
        return;
      }

      const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor) {
        setMicSupported(false);
        return;
      }

      // Drop prior recognition only (keep stream until we replace it below).
      restartingRef.current = true;
      if (commandTimerRef.current) {
        clearTimeout(commandTimerRef.current);
        commandTimerRef.current = null;
      }
      const prev = recognitionRef.current;
      recognitionRef.current = null;
      if (prev) {
        prev.onresult = null;
        prev.onerror = null;
        prev.onend = null;
        try {
          prev.abort();
        } catch {
          /* ignore */
        }
        try {
          prev.stop();
        } catch {
          /* ignore */
        }
      }
      window.setTimeout(() => {
        restartingRef.current = false;
      }, 100);

      const bootRecognition = () => {
        if (!listeningOnRef.current) return;
        if (
          phaseRef.current === "speaking" ||
          phaseRef.current === "thinking"
        ) {
          // Acquired stream during mute window — release it.
          const leaked = captureStreamRef.current;
          captureStreamRef.current = null;
          disableMediaStreamTracks(leaked);
          stopMediaStreamTracks(leaked);
          return;
        }

        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognitionRef.current = recognition;

        phaseRef.current =
          mode === "command" ? "listening_command" : "listening_wake";
        setPhase(phaseRef.current);
        if (mode === "command") armSilenceEnd();
        else clearSilenceEnd();

        const commitUtterance = (raw: string) => {
          const text = raw.trim();
          if (!text) return;

          // One mic turn at a time — drop re-entrant finals / timer races.
          if (
            micCommitLockRef.current ||
            askInFlightRef.current ||
            phaseRef.current === "thinking" ||
            phaseRef.current === "speaking"
          ) {
            return;
          }

          if (isCloseIntent(text)) {
            commandBufferRef.current = "";
            if (commandTimerRef.current) {
              clearTimeout(commandTimerRef.current);
              commandTimerRef.current = null;
            }
            goDormantRef.current();
            return;
          }

          if (isWakeOnly(text)) {
            openConversationRef.current();
            return;
          }

          const rest = stripWake(text) || text;
          if (!looksLikeCommand(rest)) return;

          const norm = normalizeUtterance(rest);
          const prev = lastMicCommitRef.current;
          if (
            prev &&
            Date.now() - prev.at < UTTERANCE_DEDUPE_MS &&
            (prev.norm === norm ||
              prev.norm.includes(norm) ||
              norm.includes(prev.norm))
          ) {
            return;
          }

          // Claim the turn synchronously, then kill recognition before ask.
          micCommitLockRef.current = true;
          lastMicCommitRef.current = { norm, at: Date.now() };
          commandBufferRef.current = "";
          if (commandTimerRef.current) {
            clearTimeout(commandTimerRef.current);
            commandTimerRef.current = null;
          }
          clearSilenceEnd();
          phaseRef.current = "thinking";
          setPhase("thinking");
          killMic();

          void askNovaRef.current(rest).finally(() => {
            micCommitLockRef.current = false;
          });
        };

        recognition.onresult = (event) => {
          // Hard-ignore while muted for TTS / thinking (no barge-in).
          if (
            micCommitLockRef.current ||
            askInFlightRef.current ||
            phaseRef.current === "speaking" ||
            phaseRef.current === "thinking"
          ) {
            return;
          }

          let chunk = "";
          let isFinal = false;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            chunk += event.results[i][0]?.transcript ?? "";
            if (event.results[i].isFinal) isFinal = true;
          }
          const text = chunk.trim();
          if (!text) return;

          // Dormant / not in a chat: ignore ambient talk until "Hey Nova".
          if (phaseRef.current === "listening_wake") {
            if (!containsWake(text)) return;

            if (isWakeOnly(text) || stripWake(text).length < 2) {
              if (commandTimerRef.current) {
                clearTimeout(commandTimerRef.current);
                commandTimerRef.current = null;
              }
              commandBufferRef.current = "";
              beep();
              openConversationRef.current();
              return;
            }

            // "Hey Nova, what's the status" — wake + ask in one breath.
            const rest = stripWake(text);
            if (!looksLikeCommand(rest)) {
              beep();
              openConversationRef.current();
              return;
            }

            beep();
            phaseRef.current = "listening_command";
            setPhase("listening_command");
            armSilenceEnd();
            commandBufferRef.current = rest;
            if (commandTimerRef.current) {
              clearTimeout(commandTimerRef.current);
              commandTimerRef.current = null;
            }
            if (rest.length > 6 && isFinal) {
              commitUtterance(rest);
              return;
            }
            commandTimerRef.current = setTimeout(() => {
              commitUtterance(commandBufferRef.current);
            }, 1400);
            return;
          }

          if (phaseRef.current === "listening_command") {
            armSilenceEnd();

            if (isWakeOnly(text)) {
              armSilenceEnd();
              return;
            }

            if (isCloseIntent(text)) {
              if (commandTimerRef.current) {
                clearTimeout(commandTimerRef.current);
                commandTimerRef.current = null;
              }
              commandBufferRef.current = "";
              goDormantRef.current();
              return;
            }

            const rest = stripWake(text) || text;
            if (!looksLikeCommand(rest)) return;

            // Same final text already queued — ignore duplicate browser finals.
            const norm = normalizeUtterance(rest);
            if (
              commandBufferRef.current &&
              normalizeUtterance(commandBufferRef.current) === norm &&
              isFinal &&
              commandTimerRef.current
            ) {
              return;
            }

            commandBufferRef.current = rest;
            if (commandTimerRef.current) {
              clearTimeout(commandTimerRef.current);
              commandTimerRef.current = null;
            }
            // Final → commit promptly; interim keeps assembling.
            if (isFinal) {
              commitUtterance(rest);
              return;
            }
            commandTimerRef.current = setTimeout(() => {
              commitUtterance(commandBufferRef.current);
            }, 1200);
          }
        };

        recognition.onerror = (ev) => {
          if (ev.error === "not-allowed") {
            setError(
              autoListenRef.current
                ? "Microphone blocked. Enable it in Safari Settings for this site, then reopen via the Hey Nova Shortcut."
                : "Allow the microphone. Nova needs it to always listen."
            );
            setNeedsGesture(true);
            recognitionRef.current = null;
            const deniedStream = captureStreamRef.current;
            captureStreamRef.current = null;
            disableMediaStreamTracks(deniedStream);
            stopMediaStreamTracks(deniedStream);
            if (autoListenRef.current) {
              // Do not raise a tap wall — glasses / Shortcut cannot satisfy it.
              listenTapNeededRef.current = false;
              setListenTapNeeded(false);
              setPhase("idle");
              phaseRef.current = "idle";
            } else {
              setListeningOn(false);
              listeningOnRef.current = false;
              setPhase("idle");
            }
          }
        };

        recognition.onend = () => {
          if (restartingRef.current) return;
          if (!listeningOnRef.current) return;
          // Do not revive capture while thinking/speaking — that stalls TTS.
          if (
            phaseRef.current === "speaking" ||
            phaseRef.current === "thinking"
          ) {
            return;
          }
          // Chrome drops continuous sessions — spawn a fresh one.
          window.setTimeout(() => {
            if (!listeningOnRef.current) return;
            if (
              phaseRef.current === "speaking" ||
              phaseRef.current === "thinking"
            ) {
              return;
            }
            if (recognitionRef.current !== recognition) return;
            recognitionRef.current = null;
            const nextMode: ListenMode =
              phaseRef.current === "listening_command" ? "command" : "wake";
            startMicRef.current(nextMode);
          }, 250);
        };

        try {
          recognition.start();
          setNeedsGesture(false);
          if (autoListenRef.current && mode === "command") {
            listenTapNeededRef.current = false;
            setListenTapNeeded(false);
            setError(null);
          }
        } catch {
          setNeedsGesture(true);
          recognitionRef.current = null;
          if (autoListenRef.current) {
            // Retry shortly — prior mic grant often works after Safari settles.
            listenTapNeededRef.current = false;
            setListenTapNeeded(false);
            setError(null);
            window.setTimeout(() => {
              if (!listeningOnRef.current || recognitionRef.current) return;
              if (
                phaseRef.current === "speaking" ||
                phaseRef.current === "thinking"
              ) {
                return;
              }
              startMicRef.current(mode);
            }, 400);
          } else {
            setError("Tap the orb once to enable always-on listening.");
          }
        }
      };

      // Own a MediaStream so hard-mute can disable/stop tracks before TTS.
      // Re-acquire after hard mute stopped tracks (Bluetooth SCO release).
      const ensureCaptureThenBoot = async () => {
        if (
          !listeningOnRef.current ||
          phaseRef.current === "speaking" ||
          phaseRef.current === "thinking"
        ) {
          return;
        }
        try {
          if (!mediaStreamIsLive(captureStreamRef.current)) {
            stopMediaStreamTracks(captureStreamRef.current);
            captureStreamRef.current = null;
            if (navigator.mediaDevices?.getUserMedia) {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                },
                video: false,
              });
              // Hard mute may have started while permission UI / getUserMedia ran.
              const phaseAfterGrant = phaseRef.current as Phase;
              if (
                !listeningOnRef.current ||
                phaseAfterGrant === "speaking" ||
                phaseAfterGrant === "thinking"
              ) {
                disableMediaStreamTracks(stream);
                stopMediaStreamTracks(stream);
                return;
              }
              captureStreamRef.current = stream;
            }
          } else {
            for (const track of captureStreamRef.current!.getAudioTracks()) {
              track.enabled = true;
            }
          }
        } catch {
          /* Recognition may still open its own capture. */
        }
        bootRecognition();
      };

      void ensureCaptureThenBoot();
    },
    [armSilenceEnd, clearSilenceEnd, killMic]
  );

  useEffect(() => {
    startMicRef.current = startMic;
  }, [startMic]);

  /**
   * Sentence-streamed server TTS: fetch chunk N+1 while chunk N plays.
   * Accepts full text, or a live queue fed while chat SSE streams.
   */
  const speak = useCallback(
    async (
      input: string | { take: () => Promise<string | null> },
      after: ListenMode = "wake",
      fullTextForFallback?: string,
      opts?: { skipTapRecovery?: boolean }
    ) => {
      const epoch = outputEpochRef.current;
      const stillCurrent = () => outputEpochRef.current === epoch;
      const skipTapRecovery = Boolean(opts?.skipTapRecovery);

      speakAbortRef.current?.abort();
      const speakAc = new AbortController();
      speakAbortRef.current = speakAc;

      resumeModeRef.current = after;
      phaseRef.current = "speaking";
      setPhase("speaking");
      // Hard mute immediately — do not wait for user silence / mute.
      killMic();
      waitingForTapRef.current = false;
      pendingVoiceRef.current = null;

      const providerLabel = (provider?: string) =>
        provider === "openai"
          ? "OpenAI voice"
          : provider === "google"
            ? "Google British"
            : provider === "elevenlabs"
              ? "ElevenLabs"
              : null;

      /** Re-assert hard mute + settle so iOS leaves SCO before each play(). */
      const beforePlay = async () => {
        if (!stillCurrent()) throw new DOMException("aborted", "AbortError");
        await pauseMicForSpeech({ settleMs: micSettleMsForDevice() });
        const el = audioElRef.current;
        if (el) {
          primeAudioElement(el);
          el.muted = false;
          el.volume = 1;
        }
        if (!stillCurrent()) throw new DOMException("aborted", "AbortError");
      };

      const playServerBlob = async (blob: Blob): Promise<string> => {
        let ctx = audioCtxRef.current;
        if (!ctx) {
          const AC = getAudioContextClass();
          if (AC) {
            ctx = new AC();
            audioCtxRef.current = ctx;
          }
        }

        let lastErr: unknown;
        if (ctx) {
          for (let attempt = 0; attempt < 2; attempt++) {
            if (!stillCurrent()) throw new DOMException("aborted", "AbortError");
            try {
              if (ctx.state === "suspended") {
                await ctx.resume();
              }
              // Pause mic immediately before output — not after play() starts.
              await beforePlay();
              await playBlobViaAudioContext(ctx, blob, {
                signal: speakAc.signal,
                onSource: (source) => {
                  activeSourceRef.current = source;
                },
              });
              activeSourceRef.current = null;
              return attempt === 0
                ? "auto:audiocontext"
                : "auto:audiocontext-retry";
            } catch (err) {
              activeSourceRef.current = null;
              if (err instanceof DOMException && err.name === "AbortError") {
                throw err;
              }
              lastErr = err;
            }
          }
        }

        if (audioElRef.current) {
          if (!stillCurrent()) throw new DOMException("aborted", "AbortError");
          try {
            await beforePlay();
            await playBlobOnElement(audioElRef.current, blob, objectUrlRef);
            return "auto:audio";
          } catch (err) {
            lastErr = err;
          }
        }

        throw lastErr instanceof Error
          ? lastErr
          : new Error("Server TTS playback failed");
      };

      // Normalize input into an async chunk iterator.
      let take: () => Promise<string | null>;
      let fallbackText = fullTextForFallback ?? "";
      if (typeof input === "string") {
        const chunks = splitIntoSpeakChunks(input);
        fallbackText = input;
        let idx = 0;
        take = async () => (idx < chunks.length ? chunks[idx++]! : null);
      } else {
        take = () => input.take();
      }

      const prefetch = new Map<number, Promise<VoiceFetchResult>>();
      const ensureFetch = (i: number, text: string) => {
        if (!prefetch.has(i)) {
          prefetch.set(i, fetchVoiceAudio(text, speakAc.signal));
        }
        return prefetch.get(i)!;
      };

      let voiceBlob: Blob | null = null;
      let useBrowserTts = false;
      let prefetchedUrl: string | undefined;
      let fetchMeta: VoiceFetchResult | null = null;
      let playedAny = false;
      const spokenParts: string[] = [];

      try {
        if (!stillCurrent()) return;

        if (!isIOS()) {
          if (!audioUnlockedRef.current) {
            await unlockAudio();
          }
          if (!stillCurrent()) return;
          stopNativeTts();
          window.speechSynthesis?.cancel();
        }

        // Pull first chunk (may wait on live SSE sentence queue).
        let chunkIndex = 0;
        let nextChunk = await take();
        if (!nextChunk) {
          if (!stillCurrent()) return;
          resumeAfterSpeech(after);
          return;
        }

        // Pipeline: while playing i, prefetch i+1.
        while (nextChunk && stillCurrent()) {
          const text = nextChunk;
          spokenParts.push(text);
          const fetchPromise = ensureFetch(chunkIndex, text);

          // Speculatively pull + prefetch the following sentence.
          const upcomingPromise = take();
          void upcomingPromise.then((upcoming) => {
            if (upcoming && stillCurrent()) {
              ensureFetch(chunkIndex + 1, upcoming);
            }
          });

          fetchMeta = await fetchPromise;
          if (!stillCurrent()) return;

          voiceBlob = fetchMeta.blob;
          useBrowserTts = fetchMeta.useBrowserTts;

          setVoiceDebug(
            formatVoiceDiag({
              unlocked: audioUnlockedRef.current,
              status: fetchMeta.status,
              contentType: fetchMeta.contentType,
              bytes: fetchMeta.bytes,
              format: fetchMeta.format,
              path: `chunk:${chunkIndex}`,
              error: fetchMeta.error,
            })
          );

          const usingDeviceTts = useBrowserTts || !voiceBlob;

          if (voiceBlob && !usingDeviceTts) {
            prefetchedUrl = prefetchVoiceUrl(voiceBlob, fetchMeta.format);
            setVoicePathLabel(providerLabel(fetchMeta.provider));

            if (audioUnlockedRef.current) {
              try {
                const path = await playServerBlob(voiceBlob);
                if (!stillCurrent()) return;
                playedAny = true;
                setVoiceDebug(
                  formatVoiceDiag({
                    unlocked: true,
                    path: `${path}+chunk${chunkIndex}`,
                    bytes: fetchMeta.bytes,
                    format: fetchMeta.format,
                  })
                );
                setError(null);
                chunkIndex += 1;
                nextChunk = await upcomingPromise;
                continue;
              } catch (err) {
                if (!stillCurrent()) return;
                if (err instanceof DOMException && err.name === "AbortError") {
                  return;
                }
                const msg =
                  err instanceof Error ? err.message : "autoplay failed";
                setVoiceDebug(
                  formatVoiceDiag({ path: "auto:fail", error: msg })
                );
              }
            }

            // Could not autoplay this chunk — queue silent recovery for remainder.
            if (!stillCurrent()) return;
            if (skipTapRecovery) {
              setError(null);
              return;
            }
            const remainder = [text, await upcomingPromise]
              .concat(
                await (async () => {
                  const rest: string[] = [];
                  for (;;) {
                    const c = await take();
                    if (!c) break;
                    rest.push(c);
                  }
                  return rest;
                })()
              )
              .filter((s): s is string => Boolean(s))
              .join(" ");
            queueSilentRecovery(
              {
                text: remainder || fallbackText || text,
                blob: voiceBlob,
                url: prefetchedUrl,
                after,
                useBrowserTts: false,
              },
              fetchMeta
            );
            setError(null);
            return;
          }

          // Server TTS unavailable — fall back once for the full reply.
          const remainder = [text, await upcomingPromise]
            .concat(
              await (async () => {
                const rest: string[] = [];
                for (;;) {
                  const c = await take();
                  if (!c) break;
                  rest.push(c);
                }
                return rest;
              })()
            )
            .filter((s): s is string => Boolean(s))
            .join(" ");
          const speakAll = remainder || fallbackText || text;

          if (isNovaApk() && hasNativeTts()) {
            setVoicePathLabel("Device voice");
            await beforePlay();
            await speakWithNative(speakAll);
            if (!stillCurrent()) return;
            setVoiceDebug(null);
            setError(null);
            return;
          }

          if (isIOS() || isMobileTouchDevice()) {
            if (!stillCurrent()) return;
            if (skipTapRecovery) {
              setError(null);
              return;
            }
            setVoicePathLabel("Device voice");
            queueSilentRecovery(
              {
                text: speakAll,
                blob: null,
                after,
                useBrowserTts: true,
              },
              fetchMeta
            );
            setError(null);
            return;
          }

          setVoicePathLabel("Device voice");
          await beforePlay();
          await speakWithFreeVoice(speakAll);
          if (!stillCurrent()) return;
          setVoiceDebug(null);
          setError(null);
          return;
        }

        if (playedAny) setError(null);
      } catch (err) {
        if (!stillCurrent()) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        const joined =
          fallbackText || spokenParts.join(" ") || "Nova voice failed";
        if (skipTapRecovery) {
          setError(null);
          return;
        }
        if (
          err instanceof NeedsGesturePlaybackError ||
          needsGestureForVoice()
        ) {
          queueSilentRecovery(
            {
              text: joined,
              blob: voiceBlob,
              url: prefetchedUrl,
              after,
              useBrowserTts: useBrowserTts || !voiceBlob,
            },
            fetchMeta ?? undefined
          );
          setError(null);
          return;
        }
        try {
          if (!(isIOS() || isMobileTouchDevice())) {
            await beforePlay();
            await speakWithFreeVoice(joined);
            if (!stillCurrent()) return;
            setVoiceDebug(null);
            setError(null);
            return;
          }
        } catch {
          /* fall through */
        }
        if (!stillCurrent()) return;
        queueSilentRecovery(
          {
            text: joined,
            blob: voiceBlob,
            url: prefetchedUrl,
            after,
            useBrowserTts: useBrowserTts || !voiceBlob,
          },
          fetchMeta ?? undefined
        );
        setError(null);
      } finally {
        if (speakAbortRef.current === speakAc) {
          speakAbortRef.current = null;
        }
        if (!stillCurrent()) return;
        resumeAfterSpeech(after);
      }
    },
    [
      killMic,
      pauseMicForSpeech,
      prefetchVoiceUrl,
      queueSilentRecovery,
      resumeAfterSpeech,
      speakWithFreeVoice,
      unlockAudio,
    ]
  );

  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  const goDormant = useCallback(() => {
    clearSilenceEnd();
    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = null;
    }
    commandBufferRef.current = "";
    // Close-intent can land while she's thinking/speaking — cancel and sleep.
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      speakAbortRef.current?.abort();
      speakAbortRef.current = null;
      liveSpeakQueueRef.current?.close();
      liveSpeakQueueRef.current = null;
      chatSeqRef.current += 1;
      outputEpochRef.current += 1;
      try {
        activeSourceRef.current?.stop(0);
      } catch {
        /* ignore */
      }
      activeSourceRef.current = null;
      stopNativeTts();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      const el = audioElRef.current;
      if (el) {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      }
      pendingVoiceRef.current = null;
      waitingForTapRef.current = false;
    }
    phaseRef.current = "listening_wake";
    setPhase("listening_wake");
    resumeModeRef.current = "wake";
    // Keep the live mic; only restart if it died.
    if (!recognitionRef.current && listeningOnRef.current) {
      startMicRef.current("wake");
    }
  }, [clearSilenceEnd]);

  const openConversation = useCallback(() => {
    handleUserGesture();
    // Do not reopen mic during thinking/speaking — duplex hard-mute.
    if (
      phaseRef.current === "speaking" ||
      phaseRef.current === "thinking"
    ) {
      return;
    }
    phaseRef.current = "listening_command";
    setPhase("listening_command");
    armSilenceEnd();
    if (!recognitionRef.current && listeningOnRef.current) {
      startMicRef.current("command");
    }
  }, [armSilenceEnd, handleUserGesture]);

  useEffect(() => {
    goDormantRef.current = goDormant;
  }, [goDormant]);

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

  /** Stop in-flight chat reply audio so a new ask can take over. */
  const interruptOutput = useCallback(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    liveSpeakQueueRef.current?.close();
    liveSpeakQueueRef.current = null;
    outputEpochRef.current += 1;
    try {
      activeSourceRef.current?.stop(0);
    } catch {
      /* ignore */
    }
    activeSourceRef.current = null;
    stopNativeTts();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    const el = audioElRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    pendingVoiceRef.current = null;
    waitingForTapRef.current = false;
  }, []);

  const askNova = useCallback(
    async (message: string) => {
      const cleaned = message.trim();
      if (!cleaned || isWakeOnly(cleaned)) {
        openConversation();
        return;
      }

      if (isCloseIntent(cleaned)) {
        goDormant();
        return;
      }

      const norm = normalizeUtterance(cleaned);
      // Same/similar utterance while a turn is already running → drop (no 2nd API).
      if (askInFlightRef.current) {
        const prev = lastMicCommitRef.current;
        if (
          prev &&
          Date.now() - prev.at < UTTERANCE_DEDUPE_MS &&
          (prev.norm === norm ||
            prev.norm.includes(norm) ||
            norm.includes(prev.norm))
        ) {
          return;
        }
      }

      askInFlightRef.current = true;
      lastMicCommitRef.current = { norm, at: Date.now() };

      // Supersede any in-flight chat/speak — conversation stays interruptible
      // for a *different* user turn (typed / new command), not duplicate finals.
      interruptOutput();
      const ac = new AbortController();
      chatAbortRef.current = ac;
      const seq = ++chatSeqRef.current;

      // Unlock in this call stack when askNova runs from a tap/submit gesture.
      unlockAudioInGesture();
      setError(null);
      waitingForTapRef.current = false;
      pendingVoiceRef.current = null;
      clearSilenceEnd();
      phaseRef.current = "thinking";
      setPhase("thinking");
      // Keep mic OFF while thinking → speaking. Open capture holds the audio
      // session on glasses/phone and stalls TTS until the user mutes.
      // Mic returns via resumeAfterSpeech after she finishes (barge-in after).
      resumeModeRef.current = "command";
      killMic();

      const assistantId = `a-${Date.now()}`;
      setLines((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: cleaned },
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const liveQueue = createLiveSpeakQueue();
      liveSpeakQueueRef.current = liveQueue;
      let speakPromise: Promise<void> | null = null;
      let streamBuf = "";
      let startedSpeak = false;

      const ensureSpeakStarted = () => {
        if (startedSpeak || chatSeqRef.current !== seq) return;
        startedSpeak = true;
        // Kick TTS as soon as sentence 1 is ready — don't wait for full reply.
        speakPromise = speak(liveQueue, "command").finally(() => {
          if (liveSpeakQueueRef.current === liveQueue) {
            liveSpeakQueueRef.current = null;
          }
        });
      };

      const pushFromBuffer = (forceLong = false) => {
        let { sentences, rest } = pullCompleteSentences(streamBuf);
        streamBuf = rest;
        if (forceLong) {
          const forced = forceSplitLongRest(streamBuf);
          if (forced.sentences.length) {
            sentences = [...sentences, ...forced.sentences];
            streamBuf = forced.rest;
          }
        }
        for (const s of sentences) {
          liveQueue.push(s);
          ensureSpeakStarted();
        }
      };

      try {
        const res = await fetch("/api/nova/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: cleaned, stream: true }),
          signal: ac.signal,
        });
        if (chatSeqRef.current !== seq) {
          liveQueue.close();
          return;
        }
        if (!res.ok) {
          let errMsg = "Nova failed";
          try {
            const data = (await res.json()) as { error?: string };
            errMsg = data.error ?? errMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errMsg);
        }

        const reply = await readNovaChatSse(res, {
          onDelta: (delta) => {
            if (chatSeqRef.current !== seq) return;
            streamBuf += delta;
            setLines((prev) =>
              prev.map((line) =>
                line.id === assistantId
                  ? { ...line, content: (line.content || "") + delta }
                  : line
              )
            );
            pushFromBuffer(true);
          },
          onDone: (finalReply) => {
            if (chatSeqRef.current !== seq) return;
            setLines((prev) =>
              prev.map((line) =>
                line.id === assistantId
                  ? { ...line, content: finalReply || line.content || "…" }
                  : line
              )
            );
          },
        });

        if (chatSeqRef.current !== seq) {
          liveQueue.close();
          return;
        }

        // Flush any remainder without terminal punctuation.
        if (streamBuf.trim()) {
          liveQueue.push(streamBuf.trim());
          streamBuf = "";
          ensureSpeakStarted();
        } else if (!startedSpeak && reply.trim()) {
          // No deltas (tool-only path) — speak the finished reply in chunks.
          for (const chunk of splitIntoSpeakChunks(reply)) {
            liveQueue.push(chunk);
          }
          ensureSpeakStarted();
        }

        liveQueue.close();
        void refreshStatus();
        if (chatSeqRef.current !== seq) return;
        if (speakPromise) {
          await speakPromise;
        } else if (reply.trim()) {
          await speak(reply, "command");
        } else {
          phaseRef.current = "listening_command";
          setPhase("listening_command");
          resumeAfterSpeech("command");
        }
      } catch (err) {
        liveQueue.close();
        if (ac.signal.aborted || chatSeqRef.current !== seq) return;
        const msg = err instanceof Error ? err.message : "Nova failed";
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(msg);
        phaseRef.current = "listening_wake";
        setPhase("listening_wake");
        window.setTimeout(() => {
          if (listeningOnRef.current) startMicRef.current("wake");
        }, 350);
      } finally {
        // Only the active turn clears the in-flight flag (superseded keeps it).
        if (chatSeqRef.current === seq) {
          askInFlightRef.current = false;
        }
      }
    },
    [
      clearSilenceEnd,
      goDormant,
      interruptOutput,
      killMic,
      openConversation,
      refreshStatus,
      resumeAfterSpeech,
      speak,
      unlockAudioInGesture,
    ]
  );

  useEffect(() => {
    askNovaRef.current = askNova;
  }, [askNova]);

  // Always-on on mount — wake word by default; ?listen=1 / ?q= → Shortcut path.
  useEffect(() => {
    listeningOnRef.current = true;
    setListeningOn(true);
    const wantListen = autoListen || readListenIntentFromLocation();
    const initialQ = readQueryUtteranceFromLocation();
    if (wantListen || initialQ) {
      void runListenReadySequence(false);
    } else {
      startMic("wake");
    }
    return () => {
      listeningOnRef.current = false;
      killMic();
      clearSilenceEnd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const toggleListening = () => {
    // Orb pointerdown already drained a pending reply — don't mute/unmute.
    if (drainedPendingRef.current) {
      drainedPendingRef.current = false;
      return;
    }
    // Wake gate / pending reply: this tap arms voice, never mutes.
    if (listenTapNeededRef.current || (waitingForTapRef.current && pendingVoiceRef.current)) {
      handleUserGesture();
      drainedPendingRef.current = false;
      return;
    }
    handleUserGesture();
    if (listeningOn) {
      setListeningOn(false);
      listeningOnRef.current = false;
      killMic();
      clearSilenceEnd();
      setPhase("idle");
      return;
    }
    setListeningOn(true);
    listeningOnRef.current = true;
    setNeedsGesture(false);
    startMic(autoListenRef.current ? "command" : "wake");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // New message supersedes a queued reply; unlock in this submit gesture.
    unlockAudioInGesture();
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    void askNova(stripWake(msg) || msg);
  };

  const wrapClass =
    phase === "listening_wake"
      ? "nova-orb-wrap is-wake"
      : phase === "listening_command"
        ? "nova-orb-wrap is-command"
        : phase === "thinking"
          ? "nova-orb-wrap is-think"
          : phase === "speaking"
            ? "nova-orb-wrap is-speak"
            : "nova-orb-wrap";

  const waveLive =
    listeningOn &&
    !listenTapNeeded &&
    (phase === "listening_wake" || phase === "listening_command");

  const phaseLabel = listenTapNeeded
    ? "tap orb to unlock voice"
    : !listeningOn
      ? "mic off · tap orb to listen"
      : phase === "idle"
        ? shortcutListen
          ? "stand by…"
          : "starting…"
        : phase === "listening_wake"
          ? "say “hey nova”"
          : phase === "listening_command"
            ? shortcutListen
              ? "Listening…"
              : "listening: no wake needed"
            : phase === "thinking"
              ? "Thinking… · mic muted"
              : phase === "speaking"
                ? "Speaking…"
                : "";

  const pipelineBars = [
    { label: "Lds", value: status?.companies ?? 0, tone: "cyan" as const },
    { label: "Appr", value: status?.approvedDrafts ?? 0, tone: "violet" as const },
    { label: "Q", value: status?.queuedJobs ?? 0, tone: "pink" as const },
    { label: "Sent", value: status?.sentDrafts ?? 0, tone: "cyan" as const },
    { label: "Pend", value: status?.pendingDrafts ?? 0, tone: "amber" as const },
  ];
  const clientSegments = [
    {
      value: status?.business?.payingClients ?? 0,
      color: "#56d6ff",
    },
    {
      value: status?.business?.trialingClients ?? 0,
      color: "#7c5cff",
    },
    {
      value: status?.business?.pastDueClients ?? 0,
      color: "#ffb347",
    },
    {
      value: status?.business?.canceledClients ?? 0,
      color: "#ff4fd8",
    },
  ];
  const funnelSteps = [
    {
      label: "Sent",
      value: status?.sentInWindow ?? status?.sentDrafts ?? 0,
      tone: "tone-cyan",
    },
    {
      label: "Signup",
      value: status?.conversionsMatched ?? 0,
      tone: "tone-violet",
    },
    {
      label: "Paid",
      value: status?.subscribedCount ?? 0,
      tone: "tone-pink",
    },
  ];
  const activityRadar = [
    {
      label: "Signups 7d",
      value: status?.business?.activation?.signupsLast7d ?? 0,
      max: Math.max(status?.business?.activation?.signupsLast7d ?? 0, 5),
    },
    {
      label: "Inspect 7d",
      value: status?.business?.activation?.inspectionsLast7d ?? 0,
      max: Math.max(status?.business?.activation?.inspectionsLast7d ?? 0, 5),
    },
    {
      label: "Queue",
      value: status?.queuedJobs ?? 0,
      max: Math.max(status?.queuedJobs ?? 0, status?.dailyTarget ?? 10, 5),
    },
    {
      label: "Target",
      value: status?.dailyTarget ?? 0,
      max: Math.max(status?.dailyTarget ?? 0, 50),
    },
  ];

  return (
    <div
      className="nova-shell"
      onTouchStart={handleUserGesture}
      onPointerDown={handleUserGesture}
    >
      <audio
        ref={audioElRef}
        playsInline
        preload="auto"
        className="nova-audio-hidden"
        aria-hidden
      />
      <div className="nova-void" aria-hidden />
      <div className="nova-stars" aria-hidden />
      <div className="nova-grid" aria-hidden />
      <div className="nova-scanlines" aria-hidden />
      <div className="nova-vignette" aria-hidden />

      <div className="nova-layout">
      <header className="nova-top">
        <div className="nova-top-inner">
          <div className="flex flex-col gap-2">
            <div className="nova-sys-label inline-flex items-center gap-1.5 normal-case tracking-normal">
              <RideByWordmark
                variant="light"
                className="text-[0.7rem] text-cyan-200/70"
              />
              <span className="uppercase tracking-[0.28em] text-white/35">
                · Systems
              </span>
            </div>
            <Link href="/nexus" className="nova-link">
              Nexus
            </Link>
            <Link href="/nova/download" className="nova-link">
              Download
            </Link>
            <Link href="/nova/shortcut" className="nova-link">
              Siri Shortcut
            </Link>
          </div>
          <div className="nova-clock-block" aria-hidden>
            <div className="nova-clock">{clock}</div>
            <div className="nova-clock-sub">Eastern · ops window 10–15</div>
          </div>
          <div className="nova-meta">
            <div className="flex items-center gap-2">
              <span
                className={
                  listeningOn
                    ? "nova-status-dot nova-status-dot-on"
                    : "nova-status-dot nova-status-dot-off"
                }
              />
              <span>
                {listeningOn ? "Mic live" : "Mic muted"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  status?.novaArmed
                    ? "nova-status-dot nova-status-dot-on"
                    : "nova-status-dot"
                }
              />
              <span>
                {status?.novaArmed ? "Running" : "Paused"} ·{" "}
                {status?.dailyTarget ?? "·"}/day
              </span>
            </div>
            <div className="nova-meta-dim">
              {voicePathLabel ??
                (status?.voiceProvider === "openai"
                  ? "OpenAI voice"
                  : status?.voiceProvider === "google"
                    ? "Google British"
                    : status?.voiceProvider === "elevenlabs" ||
                        status?.voiceConfigured
                      ? "ElevenLabs"
                      : "Device voice")}
              {" · "}
              {audioUnlocked ? "sound on" : "sound locked"}
              {" · "}
              {status?.resendConfigured ? "Resend key set" : "waiting on domain"}
            </div>
            <div className="nova-meta-dim">
              {status?.conversionsMatched ?? 0} signups
              {status?.conversionRate != null
                ? ` · ${status.conversionRate}%`
                : ""}
            </div>
          </div>
        </div>
      </header>

      <aside className="nova-hud nova-hud-left" aria-label="Pipeline HUD">
        <div className="nova-hud-title">Pipeline</div>
        <NovaBarChart items={pipelineBars} height={52} />
        <div className="nova-hud-caption">Stage volume</div>
        <div className="nova-hud-divider" />
        <div className="nova-hud-row">
          <span>Queue</span>
          <strong>{status?.queuedJobs ?? 0}</strong>
        </div>
        <NovaSparkline
          values={
            telemetry.queued.length
              ? telemetry.queued
              : [0, status?.queuedJobs ?? 0]
          }
          stroke="rgba(255,79,216,0.95)"
          fill="rgba(255,79,216,0.18)"
          height={28}
        />
        <div className="nova-hud-divider" />
        <NovaRadarBars items={activityRadar.slice(0, 3)} />
        <div className="nova-hud-divider" />
        <div className="nova-hud-row">
          <span>Window</span>
          <strong className={status?.withinWindow ? "nova-ok" : "nova-warn"}>
            {status?.withinWindow ? "OPEN" : "CLOSED"}
          </strong>
        </div>
        <div className="nova-hud-row">
          <span>Send</span>
          <strong>{status?.sendEnabled ? "ON" : "OFF"}</strong>
        </div>
        <div className="nova-hud-row">
          <span>Autonomy</span>
          <strong
            className={
              status?.novaArmed || (status?.queuedJobs ?? 0) > 0
                ? "nova-ok"
                : undefined
            }
          >
            {status?.novaArmed
              ? (status?.queuedJobs ?? 0) > 0
                ? "RUN+Q"
                : "RUN"
              : (status?.queuedJobs ?? 0) > 0
                ? "QUEUE"
                : "IDLE"}
          </strong>
        </div>
        <div className="nova-hud-note">
          {(status?.queuedJobs ?? 0) > 0
            ? "Background jobs running · chat stays open"
            : status?.novaArmed
              ? "Armed · ticks keep working offline"
              : "Prep · Resend after domain"}
        </div>
      </aside>

      <aside className="nova-hud nova-hud-right" aria-label="Business HUD">
        <div className="nova-hud-title">Business</div>
        <div className="nova-hud-donut-row">
          <NovaDonut
            segments={clientSegments}
            size={70}
            centerLabel={`$${status?.business?.mrr ?? 0}`}
            centerSub="MRR"
          />
          <div className="nova-hud-legend">
            <div>
              <i className="tone-cyan" /> Active{" "}
              {status?.business?.payingClients ?? 0}
            </div>
            <div>
              <i className="tone-violet" /> Trial{" "}
              {status?.business?.trialingClients ?? 0}
            </div>
            <div>
              <i className="tone-amber" /> Due{" "}
              {status?.business?.pastDueClients ?? 0}
            </div>
            <div>
              <i className="tone-pink" /> Cancel{" "}
              {status?.business?.canceledClients ?? 0}
            </div>
          </div>
        </div>
        <div className="nova-hud-row">
          <span>ARR</span>
          <strong>${status?.business?.arr ?? 0}</strong>
        </div>
        <NovaSparkline
          values={
            telemetry.mrr.length
              ? telemetry.mrr
              : [0, status?.business?.mrr ?? 0]
          }
          height={28}
        />
        <div className="nova-gauge-row">
          <NovaGauge value={status?.conversionRate ?? 0} label="Convert" />
          <NovaGauge value={status?.subscriptionRate ?? 0} label="Sub" />
        </div>
        <div className="nova-hud-divider" />
        <div className="nova-hud-row">
          <span>Dead paid</span>
          <strong>
            {status?.business?.activation?.payingWithZeroInspections ?? 0}
          </strong>
        </div>
        <div className="nova-hud-row">
          <span>Trial→paid</span>
          <strong>
            {status?.business?.trials?.converted ?? 0}/
            {status?.business?.trials?.claimed ?? 0}
          </strong>
        </div>
        {(status?.business?.trust?.abuseFlagged ?? 0) > 0 && (
          <div className="nova-hud-note">
            Abuse bot: {status?.business?.trust?.abuseFlagged} under-billed
            {(status?.business?.trust?.abuseHigh ?? 0) > 0
              ? ` (${status?.business?.trust?.abuseHigh} high)`
              : ""}
          </div>
        )}
      </aside>

      <main className="nova-stage">
        <div className={wrapClass}>
          <span className="nova-ring nova-ring-a" aria-hidden />
          <span className="nova-ring nova-ring-b" aria-hidden />
          <span className="nova-ring nova-ring-c" aria-hidden />
          <span className="nova-orb-halo nova-orb-halo-a" aria-hidden />
          <span className="nova-orb-halo nova-orb-halo-b" aria-hidden />
          <NovaMeshOrb
            phase={phase}
            onClick={toggleListening}
            onPointerDown={handleOrbGesture}
            onTouchStart={handleOrbGesture}
            ariaLabel={
              listeningOn ? "Mute Nova mic" : "Enable always-on listening"
            }
          />
        </div>
      </main>

      <section className="nova-telemetry" aria-label="Telemetry">
        <div className="nova-tele-card">
          <div className="nova-tele-head">
            <span>Outreach funnel</span>
            <strong>{status?.conversionRate ?? 0}%</strong>
          </div>
          <NovaFunnel steps={funnelSteps} />
        </div>
        <div className="nova-tele-card">
          <div className="nova-tele-head">
            <span>Inspect 7d</span>
            <strong>
              {status?.business?.activation?.inspectionsLast7d ?? 0}
            </strong>
          </div>
          <NovaSparkline
            values={
              telemetry.inspect7.length
                ? telemetry.inspect7
                : [0, status?.business?.activation?.inspectionsLast7d ?? 0]
            }
            height={40}
            stroke="rgba(124,92,255,0.95)"
            fill="rgba(124,92,255,0.18)"
          />
        </div>
        <div className="nova-tele-card">
          <div className="nova-tele-head">
            <span>Convert trend</span>
            <strong>{status?.conversionRate ?? 0}%</strong>
          </div>
          <NovaSparkline
            values={
              telemetry.convert.length
                ? telemetry.convert
                : [0, status?.conversionRate ?? 0]
            }
            height={40}
            stroke="rgba(86,214,255,0.95)"
            fill="rgba(86,214,255,0.16)"
          />
        </div>
        <div className="nova-tele-card nova-tele-card-wide">
          <div className="nova-tele-head">
            <span>Live ops mix</span>
            <strong>
              {status?.novaArmed ? "ARMED" : "STANDBY"} ·{" "}
              {status?.dailyTarget ?? "·"}/day
            </strong>
          </div>
          <NovaBarChart
            items={[
              {
                label: "Sent",
                value: status?.sentDrafts ?? 0,
                tone: "cyan",
              },
              {
                label: "Sign",
                value: status?.conversionsMatched ?? 0,
                tone: "violet",
              },
              {
                label: "Sub",
                value: status?.subscribedCount ?? 0,
                tone: "pink",
              },
              {
                label: "Dead",
                value:
                  status?.business?.activation?.payingWithZeroInspections ?? 0,
                tone: "amber",
              },
              {
                label: "Seat",
                value: status?.business?.teams?.multiSeatCompanies ?? 0,
                tone: "cyan",
              },
            ]}
            height={52}
          />
        </div>
      </section>

      <footer className="nova-dock">
        <div className="nova-dock-chrome" aria-hidden>
          <span>COMMS</span>
          <span className="nova-dock-chrome-mid">VOICE · TEXT · OPS</span>
          <span>{status?.novaArmed ? "ARMED" : "STANDBY"}</span>
        </div>
        <div className="nova-dock-status">
          <h1 className="nova-brand font-display">NOVA</h1>
          <p className="nova-tagline">
            {shortcutListen ? (
              phase === "thinking" ? (
                <>
                  Systems online. <span>Working…</span>
                </>
              ) : phase === "listening_command" ? (
                <>
                  Systems online. <span>Listening…</span> Speak your command.
                </>
              ) : phase === "speaking" ? (
                <>
                  Systems online. <span>Speaking…</span>
                </>
              ) : (
                <>
                  Systems online. <span>Stand by…</span>
                </>
              )
            ) : (
              <>
                Systems online. Say <span>“Hey Nova”</span>, or tap the orb.
              </>
            )}
          </p>
          <div
            className={waveLive ? "nova-wave nova-wave-live" : "nova-wave"}
            aria-hidden
          >
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="nova-phase">{phaseLabel}</p>
          {audioUnlocked && (
            <p className="nova-sound-status" aria-live="polite">
              sound on
            </p>
          )}
          {!micSupported && (
            <p className="nova-hint">
              Wake word unavailable here. Use the keyboard.
            </p>
          )}
        </div>
        <div className="nova-transcript" ref={transcriptRef}>
          {lines.length === 0 && (
            <p className="text-center text-sm text-white/25">
              Ask for pipeline, MRR, clients, or a call. Ambient talk is ignored.
            </p>
          )}
          {lines.map((line) => (
            <div
              key={line.id}
              className={`nova-line-in ${
                line.role === "user"
                  ? "ml-auto max-w-[90%] text-right"
                  : "mr-auto max-w-[92%]"
              }`}
            >
              <div
                className={
                  line.role === "user"
                    ? "text-[10px] uppercase tracking-[0.2em] text-fuchsia-200/35"
                    : "text-[10px] uppercase tracking-[0.2em] text-cyan-200/50"
                }
              >
                {line.role === "user" ? "You" : "Nova"}
              </div>
              <p
                className={
                  line.role === "user"
                    ? "mt-1 text-sm leading-relaxed text-white/65"
                    : "mt-1 font-display text-[1.05rem] leading-snug tracking-tight text-white"
                }
              >
                {line.content}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {error && (
          <p className="mt-2 text-center text-xs text-rose-300/90">{error}</p>
        )}
        <form onSubmit={onSubmit} className="nova-compose">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              phase === "thinking"
                ? "Talk anytime while she works…"
                : "Type to Nova…"
            }
            className="nova-input"
          />
          <button
            type="submit"
            className="nova-send"
            onTouchStart={handleUserGesture}
            onPointerDown={handleUserGesture}
          >
            Send
          </button>
        </form>
      </footer>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Safari often returns [] until voiceschanged — poll instead of failing early. */
function waitForSpeechVoices(
  synth: SpeechSynthesis,
  maxMs = 2500
): Promise<SpeechSynthesisVoice[]> {
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onVoices);
      clearInterval(poll);
      clearTimeout(hardStop);
      resolve(voices);
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
    synth.getVoices();
    synth.resume();
  } catch {
    /* ignore */
  }
}

function primeSpeechSynthesisInGesture(synth: SpeechSynthesis) {
  primeSpeechSynthesis(synth);
  // iOS: real speak() must happen in the Hear Nova tap — dummy utter can steal the gesture.
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

function pickPreferredVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) =>
      /samantha|karen|moira|victoria|susan|zira|google us english|Samantha/i.test(
        v.name
      )
    ) ||
    voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en"))
  );
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

/** Fetch TTS audio; never treat JSON error bodies as MPEG. */
async function fetchVoiceAudio(text: string): Promise<VoiceFetchResult> {
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
      body: JSON.stringify({
        text,
        ...(isIOS() ? { format: "wav" } : {}),
      }),
    });
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "network failed",
    };
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const format =
    res.headers.get("x-nova-format") ??
    (contentType.includes("wav") ? "wav" : contentType.includes("mpeg") ? "mpeg" : "");

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
          useBrowserTts: true,
          error:
            data.error ||
            "ElevenLabs unavailable. Using free device voice.",
        };
      }
      return {
        ...empty,
        status: 503,
        contentType: "application/json",
        format: "",
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
        useBrowserTts: true,
        error: data.error ?? "speak returned JSON",
      };
    } catch {
      return {
        ...empty,
        status: res.status,
        contentType,
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
  };
}

/** Safari/iOS: call speak() synchronously — no await before speak in this function. */
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

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clipped);
  const voices = window.speechSynthesis.getVoices();
  const preferred = pickPreferredVoice(voices);
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1.05;
  utterance.pitch = 1.08;
  utterance.volume = 1;

  return new Promise<void>((resolve, reject) => {
    let spoke = false;
    const watchdog = window.setTimeout(() => {
      if (!spoke && !window.speechSynthesis.speaking) {
        reject(new Error("Device voice did not start"));
      }
    }, 3000);
    utterance.onstart = () => {
      spoke = true;
    };
    utterance.onend = () => {
      window.clearTimeout(watchdog);
      resolve();
    };
    utterance.onerror = (event) => {
      window.clearTimeout(watchdog);
      if (event.error === "interrupted" || event.error === "canceled") {
        resolve();
        return;
      }
      reject(new Error(event.error || "Device voice failed"));
    };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    if (isSafariBrowser()) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
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
 * Play MPEG on the persistent unlocked <audio> element.
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

export function NovaConsole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);
  const [listeningOn, setListeningOn] = useState(true);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showTapToHear, setShowTapToHear] = useState(false);
  const [voiceDebug, setVoiceDebug] = useState<string | null>(null);
  const [voicePathLabel, setVoicePathLabel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    })
  );
  const [telemetry, setTelemetry] = useState<{
    mrr: number[];
    inspect7: number[];
    convert: number[];
    queued: number[];
  }>({ mrr: [], inspect7: [], convert: [], queued: [] });

  const phaseRef = useRef<Phase>("idle");
  const listeningOnRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartingRef = useRef(false);
  const commandBufferRef = useRef("");
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingVoiceRef = useRef<PendingVoice | null>(null);
  const waitingForTapRef = useRef(false);
  const gesturePlayLockRef = useRef(false);
  const unlockInFlightRef = useRef(false);
  /** After TTS, restart mic in wake (dormant) or command (open) mode. */
  const resumeModeRef = useRef<ListenMode>("command");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const openConversationRef = useRef<() => void>(() => {});
  const goDormantRef = useRef<() => void>(() => {});

  /**
   * Unlock audio inside a user gesture without clobbering a prefetched voice URL.
   * Overwriting src with a silent WAV was killing Tap-to-hear / in-progress playback.
   */
  const unlockAudioInGesture = useCallback((): boolean => {
    const el = audioElRef.current;
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;

    try {
      const AC = getAudioContextClass();
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        void audioCtxRef.current.resume();
      }

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

        // Only warm with silent WAV when nothing voice-related is loaded/playing.
        if (!hasVoiceSrc && !speakingNow && !waitingForTapRef.current) {
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
      return true;
    } catch {
      unlockInFlightRef.current = false;
      setNeedsGesture(true);
      setAudioUnlocked(false);
      setVoiceDebug(formatVoiceDiag({ unlocked: false, path: "unlock:failed" }));
      return false;
    }
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (audioUnlockedRef.current) {
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (synth) primeSpeechSynthesis(synth);
      setAudioUnlocked(true);
      return true;
    }

    // If we're somehow in a gesture context, prefer the sync path on mobile.
    if (isMobileTouchDevice()) {
      return unlockAudioInGesture();
    }

    try {
      const AC = getAudioContextClass();
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") await ctx.resume();
      }
    } catch {
      /* ignore */
    }

    const el = audioElRef.current;
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;

    if (!el) return false;

    // Warm the persistent <audio> inside a user gesture so later TTS can play.
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
      setNeedsGesture(true);
      setAudioUnlocked(false);
      return false;
    }
  }, [unlockAudioInGesture]);

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
      throw new Error("No device voices loaded yet — tap Enable sound, then try again.");
    }

    await speakWithFreeVoiceSync(clipped);
  }, []);

  const playVoiceBlob = useCallback(
    async (blob: Blob) => {
      await unlockAudio();
      const el = audioElRef.current;
      if (!el) throw new Error("Audio element missing");
      await playBlobOnElement(el, blob, objectUrlRef);
    },
    [unlockAudio]
  );

  const resumeAfterSpeech = useCallback((mode: ListenMode) => {
    setPhase(mode === "command" ? "listening_command" : "listening_wake");
    window.setTimeout(() => {
      if (listeningOnRef.current) startMicRef.current(mode);
    }, 350);
  }, []);

  useEffect(() => {
    setMounted(true);
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

  /** Hard-kill mic. Chrome will not reliably restart a stopped instance. */
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
      try {
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    }
    window.setTimeout(() => {
      restartingRef.current = false;
    }, 100);
  }, []);

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

  const handleGestureUnlock = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      unlockAudioInGesture();
      const AC = getAudioContextClass();
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        void audioCtxRef.current.resume();
      }
    },
    [unlockAudioInGesture]
  );

  const queueTapToHear = useCallback(
    (pending: PendingVoice, diag?: VoiceFetchResult) => {
      if (pending.blob && !pending.useBrowserTts) {
        pending.url = prefetchVoiceUrl(pending.blob, diag?.format);
      }
      pendingVoiceRef.current = pending;
      waitingForTapRef.current = true;
      setShowTapToHear(true);
      const pathLabel = pending.useBrowserTts
        ? diag?.error?.includes("credit") || diag?.status === 503
          ? "Device voice (ElevenLabs unavailable)"
          : "Device voice"
        : "ElevenLabs";
      setVoicePathLabel(pathLabel);
      setVoiceDebug(
        formatVoiceDiag({
          unlocked: audioUnlockedRef.current,
          status: diag?.status,
          contentType: diag?.contentType,
          bytes: diag?.bytes,
          format: diag?.format,
          path: pending.useBrowserTts ? "tap:browser-tts" : "tap:prefetched",
          error: diag?.error,
        })
      );
      if (!audioUnlockedRef.current) {
        setNeedsGesture(true);
      }
    },
    [prefetchVoiceUrl]
  );

  /**
   * Safari emergency: play() must fire synchronously inside pointerdown/touchstart.
   * Blob is prefetched — no fetch/await before play().
   */
  const playPendingNow = useCallback(() => {
    if (gesturePlayLockRef.current) return;
    const pending = pendingVoiceRef.current;
    const el = audioElRef.current;
    if (!pending || !el) {
      setVoiceDebug(formatVoiceDiag({ path: "tap", error: "nothing pending" }));
      return;
    }

    gesturePlayLockRef.current = true;

    const snapshot: PendingVoice = { ...pending };
    pendingVoiceRef.current = null;
    waitingForTapRef.current = false;
    setShowTapToHear(false);
    setPhase("speaking");
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    setNeedsGesture(false);

    // Stop mic only — do not cancel speechSynthesis before MPEG play on Safari.
    killMic({ keepSpeech: Boolean(snapshot.blob && !snapshot.useBrowserTts) });

    let playback: Promise<void>;

    if (snapshot.blob && !snapshot.useBrowserTts) {
      const srcReady =
        Boolean(snapshot.url) &&
        Boolean(el.src) &&
        (el.src === snapshot.url || el.currentSrc === snapshot.url);
      if (srcReady) {
        primeAudioElement(el);
        el.muted = false;
        el.volume = 1;
        playback = playPreparedInGesture(el, objectUrlRef);
      } else {
        // Src was clobbered or never assigned — re-bind blob and play in-gesture.
        playback = playBlobInGesture(el, snapshot.blob, objectUrlRef);
        snapshot.url = objectUrlRef.current ?? snapshot.url;
      }
    } else if (isNovaApk() && hasNativeTts()) {
      playback = speakWithNative(snapshot.text);
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      const synth = window.speechSynthesis;
      primeSpeechSynthesis(synth);
      playback = speakWithFreeVoiceSync(snapshot.text);
    } else if (hasNativeTts()) {
      playback = speakWithNative(snapshot.text);
    } else {
      gesturePlayLockRef.current = false;
      setVoiceDebug(formatVoiceDiag({ path: "tap", error: "no playback path" }));
      pendingVoiceRef.current = snapshot;
      waitingForTapRef.current = true;
      setShowTapToHear(true);
      setError("This browser has no speaker voice. Try Chrome or the Nova app.");
      return;
    }

    void playback
      .then(() => {
        setVoiceDebug(formatVoiceDiag({ unlocked: true, path: "tap:played" }));
        setError(null);
        setVoicePathLabel(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "play failed";
        setVoiceDebug(
          formatVoiceDiag({
            unlocked: audioUnlockedRef.current,
            path: "tap:failed",
            error: msg,
          })
        );
        pendingVoiceRef.current = snapshot;
        waitingForTapRef.current = true;
        setShowTapToHear(true);
        setError(
          snapshot.useBrowserTts
            ? "Device voice blocked — tap Hear Nova again (turn media volume up)."
            : "Tap Hear Nova again to play the reply."
        );
      })
      .finally(() => {
        gesturePlayLockRef.current = false;
        resumeAfterSpeech(snapshot.after);
      });
  }, [killMic, resumeAfterSpeech]);

  const onTapToHearTouch = useCallback(
    (e: React.TouchEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioInGesture();
      playPendingNow();
    },
    [playPendingNow, unlockAudioInGesture]
  );

  const onTapToHear = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (isIOS() && e.pointerType === "touch") return;
      e.preventDefault();
      e.stopPropagation();
      unlockAudioInGesture();
      playPendingNow();
    },
    [playPendingNow, unlockAudioInGesture]
  );

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

  const startMic = useCallback(
    (mode: ListenMode = "wake") => {
      if (!listeningOnRef.current) return;
      if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
        return;
      }

      const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor) {
        setMicSupported(false);
        return;
      }

      killMic();

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

        if (isCloseIntent(text)) {
          commandBufferRef.current = "";
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          goDormantRef.current();
          return;
        }

        if (isWakeOnly(text)) {
          openConversationRef.current();
          return;
        }

        const rest = stripWake(text) || text;
        if (!looksLikeCommand(rest)) return;

        commandBufferRef.current = "";
        if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
        clearSilenceEnd();
        void askNovaRef.current(rest);
      };

      recognition.onresult = (event) => {
        if (
          phaseRef.current === "thinking" ||
          phaseRef.current === "speaking"
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
            if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
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
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
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
            if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
            commandBufferRef.current = "";
            goDormantRef.current();
            return;
          }

          const rest = stripWake(text) || text;
          if (!looksLikeCommand(rest)) return;

          commandBufferRef.current = rest;
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          commandTimerRef.current = setTimeout(() => {
            commitUtterance(commandBufferRef.current);
          }, isFinal ? 450 : 1200);
        }
      };

      recognition.onerror = (ev) => {
        if (ev.error === "not-allowed") {
          setError("Allow the microphone. Nova needs it to always listen.");
          setNeedsGesture(true);
          setListeningOn(false);
          listeningOnRef.current = false;
          setPhase("idle");
          recognitionRef.current = null;
        }
      };

      recognition.onend = () => {
        if (restartingRef.current) return;
        if (!listeningOnRef.current) return;
        if (
          phaseRef.current === "thinking" ||
          phaseRef.current === "speaking"
        ) {
          return;
        }
        // Chrome drops continuous sessions — spawn a fresh one.
        window.setTimeout(() => {
          if (!listeningOnRef.current) return;
          if (
            phaseRef.current === "thinking" ||
            phaseRef.current === "speaking"
          ) {
            return;
          }
          if (recognitionRef.current !== recognition) return;
          recognitionRef.current = null;
          startMicRef.current(
            phaseRef.current === "listening_command" ? "command" : "wake"
          );
        }, 250);
      };

      try {
        recognition.start();
        setNeedsGesture(false);
      } catch {
        setNeedsGesture(true);
        setError("Tap the orb once to enable always-on listening.");
        recognitionRef.current = null;
      }
    },
    [armSilenceEnd, clearSilenceEnd, killMic]
  );

  useEffect(() => {
    startMicRef.current = startMic;
  }, [startMic]);

  const speak = useCallback(
    async (text: string, after: ListenMode = "wake") => {
      resumeModeRef.current = after;
      setPhase("speaking");
      killMic();
      setShowTapToHear(false);
      waitingForTapRef.current = false;
      pendingVoiceRef.current = null;

      let voiceBlob: Blob | null = null;
      let useBrowserTts = false;
      let prefetchedUrl: string | undefined;
      let fetchMeta: VoiceFetchResult | null = null;

      try {
        if (!isIOS()) {
          if (!audioUnlockedRef.current) {
            await unlockAudio();
          }
          stopNativeTts();
          window.speechSynthesis?.cancel();
        }

        fetchMeta = await fetchVoiceAudio(text);
        voiceBlob = fetchMeta.blob;
        useBrowserTts = fetchMeta.useBrowserTts;

        setVoiceDebug(
          formatVoiceDiag({
            unlocked: audioUnlockedRef.current,
            status: fetchMeta.status,
            contentType: fetchMeta.contentType,
            bytes: fetchMeta.bytes,
            format: fetchMeta.format,
            path: isIOS() ? "ios:fetch-done" : "fetch-done",
            error: fetchMeta.error,
          })
        );

        if (voiceBlob && !useBrowserTts) {
          prefetchedUrl = prefetchVoiceUrl(voiceBlob, fetchMeta.format);
        }

        // iOS/Safari: always need an in-gesture play(). Device TTS after any await
        // also needs a tap on mobile. ElevenLabs on unlocked desktop can autoplay.
        const usingDeviceTts = useBrowserTts || !voiceBlob;
        const mustTap =
          isIOS() ||
          needsSafariGesturePlayback() ||
          (usingDeviceTts &&
            (isMobileTouchDevice() || !audioUnlockedRef.current));

        if (mustTap) {
          queueTapToHear(
            {
              text,
              blob: voiceBlob,
              url: prefetchedUrl,
              after,
              useBrowserTts: usingDeviceTts,
            },
            fetchMeta
          );
          setPhase("speaking");
          setError(
            usingDeviceTts
              ? "Tap Hear Nova — using device voice (ElevenLabs off or out of credits)."
              : null
          );
          return;
        }

        if (voiceBlob && !useBrowserTts && audioElRef.current) {
          try {
            await playBlobOnElement(
              audioElRef.current,
              voiceBlob,
              objectUrlRef
            );
            setVoiceDebug(null);
            setVoicePathLabel(null);
            setError(null);
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "autoplay failed";
            setVoiceDebug(formatVoiceDiag({ path: "auto", error: msg }));
            queueTapToHear(
              {
                text,
                blob: voiceBlob,
                url: prefetchedUrl,
                after,
                useBrowserTts: false,
              },
              fetchMeta
            );
            setPhase("speaking");
            setError("Tap Hear Nova to play the reply.");
            return;
          }
        }

        if (useBrowserTts || !voiceBlob) {
          setVoicePathLabel(
            fetchMeta.error?.includes("credit") || fetchMeta.status === 503
              ? "Device voice (ElevenLabs unavailable)"
              : "Device voice"
          );
          await speakWithFreeVoice(text);
          setVoiceDebug(null);
          setVoicePathLabel(null);
          setError(null);
          return;
        }

        await playVoiceBlob(voiceBlob);
        setVoiceDebug(null);
        setVoicePathLabel(null);
        setError(null);
      } catch (err) {
        if (
          err instanceof NeedsGesturePlaybackError ||
          needsGestureForVoice()
        ) {
          queueTapToHear(
            {
              text,
              blob: voiceBlob,
              url: prefetchedUrl,
              after,
              useBrowserTts: useBrowserTts || !voiceBlob,
            },
            fetchMeta ?? undefined
          );
          setPhase("speaking");
          setError(
            useBrowserTts || !voiceBlob
              ? "Tap Hear Nova — device voice needs a tap."
              : "Tap Hear Nova to play the reply."
          );
          return;
        }
        try {
          await speakWithFreeVoice(text);
          setVoiceDebug(null);
          setVoicePathLabel(null);
          setError(null);
        } catch (fallbackErr) {
          const msg = err instanceof Error ? err.message : "Voice failed";
          const fbMsg =
            fallbackErr instanceof Error ? fallbackErr.message : "";
          setVoiceDebug(
            formatVoiceDiag({
              path: "err",
              error: `${msg}${fbMsg ? ` / ${fbMsg}` : ""}`,
            })
          );
          if (
            fallbackErr instanceof NeedsGesturePlaybackError ||
            /NotAllowed|interact|gesture|play blocked|did not start|Safari requires/i.test(
              `${msg} ${fbMsg}`
            )
          ) {
            queueTapToHear(
              {
                text,
                blob: voiceBlob,
                url: prefetchedUrl,
                after,
                useBrowserTts: true,
              },
              fetchMeta ?? undefined
            );
            setPhase("speaking");
            setNeedsGesture(true);
            setError("Tap Hear Nova to enable speaker audio.");
            return;
          } else if (/no free device voice|Native voice bridge|no device voices/i.test(fbMsg)) {
            setError(fbMsg);
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!waitingForTapRef.current) {
          resumeAfterSpeech(after);
        }
      }
    },
    [
      killMic,
      playVoiceBlob,
      prefetchVoiceUrl,
      queueTapToHear,
      resumeAfterSpeech,
      speakWithFreeVoice,
      unlockAudio,
    ]
  );

  const goDormant = useCallback(() => {
    clearSilenceEnd();
    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = null;
    }
    commandBufferRef.current = "";
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      resumeModeRef.current = "wake";
      return;
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
    void unlockAudio();
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      return;
    }
    phaseRef.current = "listening_command";
    setPhase("listening_command");
    armSilenceEnd();
    if (!recognitionRef.current && listeningOnRef.current) {
      startMicRef.current("command");
    }
  }, [armSilenceEnd, unlockAudio]);

  useEffect(() => {
    goDormantRef.current = goDormant;
  }, [goDormant]);

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

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

      void unlockAudio();
      setError(null);
      setShowTapToHear(false);
      waitingForTapRef.current = false;
      pendingVoiceRef.current = null;
      clearSilenceEnd();
      setPhase("thinking");
      killMic();
      // After she answers, stay open until silence / close intent says you're done.
      resumeModeRef.current = "command";

      setLines((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: cleaned },
      ]);

      try {
        const res = await fetch("/api/nova/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: cleaned }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Nova failed");

        const reply = data.reply ?? "…";
        setLines((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: reply },
        ]);
        await refreshStatus();
        await speak(reply, "command");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nova failed";
        setError(msg);
        phaseRef.current = "listening_wake";
        setPhase("listening_wake");
        window.setTimeout(() => {
          if (listeningOnRef.current) startMicRef.current("wake");
        }, 350);
      }
    },
    [
      clearSilenceEnd,
      goDormant,
      killMic,
      openConversation,
      refreshStatus,
      speak,
      unlockAudio,
    ]
  );

  useEffect(() => {
    askNovaRef.current = askNova;
  }, [askNova]);

  // Always-on on mount — dormant until intentional speech.
  useEffect(() => {
    listeningOnRef.current = true;
    setListeningOn(true);
    startMic("wake");
    return () => {
      listeningOnRef.current = false;
      killMic();
      clearSilenceEnd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const toggleListening = () => {
    void unlockAudio();
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
    startMic("wake");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void unlockAudio();
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
    (phase === "listening_wake" ||
      phase === "listening_command" ||
      phase === "speaking" ||
      phase === "thinking");

  const phaseLabel = !listeningOn
    ? "mic off · tap orb to listen"
    : phase === "idle"
      ? "starting…"
      : phase === "listening_wake"
        ? "say “hey nova”"
        : phase === "listening_command"
          ? "listening: no wake needed"
          : phase === "thinking"
            ? "thinking"
            : phase === "speaking"
              ? showTapToHear
                ? "reply ready · tap Hear Nova"
                : "speaking"
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
      onTouchStart={handleGestureUnlock}
      onPointerDown={handleGestureUnlock}
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
              <span>{listeningOn ? "Mic live" : "Mic muted"}</span>
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
                (status?.voiceConfigured ? "ElevenLabs" : "Device voice")}
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
        <div className="nova-hud-note">Prep · Resend after domain</div>
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
        <h1 className="nova-brand font-display">NOVA</h1>
        <p className="nova-tagline">
          Systems online. Say <span>“Hey Nova”</span> for outreach, MRR, clients.
        </p>

        <div className={wrapClass}>
          <span className="nova-ring nova-ring-a" aria-hidden />
          <span className="nova-ring nova-ring-b" aria-hidden />
          <span className="nova-ring nova-ring-c" aria-hidden />
          <span className="nova-orb-halo nova-orb-halo-a" aria-hidden />
          <span className="nova-orb-halo nova-orb-halo-b" aria-hidden />
          <NovaMeshOrb
            phase={phase}
            onClick={toggleListening}
            onPointerDown={handleGestureUnlock}
            onTouchStart={handleGestureUnlock}
            ariaLabel={
              listeningOn ? "Mute Nova mic" : "Enable always-on listening"
            }
          />
        </div>

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
        {!audioUnlocked && !showTapToHear && (
          <button
            type="button"
            className="nova-enable-sound"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              unlockAudioInGesture();
            }}
            onPointerDown={(e) => {
              if (isIOS() && e.pointerType === "touch") return;
              e.preventDefault();
              e.stopPropagation();
              unlockAudioInGesture();
            }}
          >
            Enable sound
          </button>
        )}
        {needsGesture && audioUnlocked === false && (
          <p className="nova-hint">
            Speaker is locked until you tap Enable sound
            {isIOS() ? " (turn up media volume)" : ""}. Mic mute is separate.
          </p>
        )}
        {showTapToHear && (
          <p className="nova-hint nova-hint-mobile">
            {voicePathLabel?.includes("Device")
              ? "ElevenLabs unavailable — tap Hear Nova for your phone/computer voice. Turn media volume up."
              : "Tap Hear Nova to play the reply. Turn media volume up."}
          </p>
        )}
        {voiceDebug && !isIOS() && (
          <p className="nova-voice-debug" aria-live="polite">
            voice: {voiceDebug}
          </p>
        )}
        {!micSupported && (
          <p className="nova-hint">
            Wake word unavailable here. Use the keyboard.
          </p>
        )}
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

      {mounted &&
        isIOS() &&
        createPortal(
          <div className="nova-voice-debug-fixed" aria-live="assertive">
            <strong>Voice debug</strong>
            <span>{voiceDebug ?? "Tap orb once, then Tap to hear"}</span>
          </div>,
          document.body
        )}

      {mounted &&
        showTapToHear &&
        createPortal(
          <button
            type="button"
            className="nova-tap-hear-fixed"
            onTouchStart={onTapToHearTouch}
            onPointerDown={onTapToHear}
            onClick={(e) => e.preventDefault()}
          >
            {voicePathLabel?.includes("Device")
              ? "Hear Nova (device voice)"
              : "Hear Nova"}
          </button>,
          document.body
        )}

      <footer className="nova-dock">
        <div className="nova-dock-chrome" aria-hidden>
          <span>COMMS</span>
          <span className="nova-dock-chrome-mid">VOICE · TEXT · OPS</span>
          <span>{status?.novaArmed ? "ARMED" : "STANDBY"}</span>
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
            placeholder="Type to Nova…"
            className="nova-input"
          />
          <button
            type="submit"
            disabled={phase === "thinking"}
            className="nova-send"
            onTouchStart={handleGestureUnlock}
            onPointerDown={handleGestureUnlock}
          >
            Send
          </button>
        </form>
      </footer>
      </div>
    </div>
  );
}

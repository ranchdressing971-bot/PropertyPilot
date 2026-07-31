"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NovaMeshOrb } from "@/components/nova/NovaMeshOrb";

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
  mailtrapConfigured: boolean;
  mailtrapSandbox: boolean;
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
  if (!isSafariBrowser()) return;
  try {
    synth.cancel();
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
  debug?: string;
}

/** Fetch TTS audio; never treat JSON error bodies as MPEG. */
async function fetchVoiceAudio(text: string): Promise<VoiceFetchResult> {
  const res = await fetch("/api/nova/speak", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (res.status === 503) {
    try {
      const data = (await res.json()) as { code?: string; error?: string };
      if (data.code === "FALLBACK_BROWSER" || !data.code) {
        return { blob: null, useBrowserTts: true };
      }
      return {
        blob: null,
        useBrowserTts: false,
        debug: data.error ?? "Voice API unavailable",
      };
    } catch {
      return { blob: null, useBrowserTts: true };
    }
  }

  if (!res.ok) {
    return { blob: null, useBrowserTts: true, debug: `speak HTTP ${res.status}` };
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("json")) {
    try {
      const data = (await res.json()) as { error?: string };
      return {
        blob: null,
        useBrowserTts: true,
        debug: data.error ?? "speak returned JSON",
      };
    } catch {
      return { blob: null, useBrowserTts: true, debug: "speak returned JSON" };
    }
  }

  const blob = await res.blob();
  if (!blob.size) {
    return { blob: null, useBrowserTts: true, debug: "empty audio blob" };
  }

  if (blob.type.includes("json")) {
    return { blob: null, useBrowserTts: true, debug: "blob is JSON not audio" };
  }

  return { blob: normalizeAudioBlob(blob), useBrowserTts: false };
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

function normalizeAudioBlob(blob: Blob): Blob {
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  return new Blob([blob], { type: "audio/mpeg" });
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
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "true");
  (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
}

/**
 * Tap-handler path when src is already set (prefetched).
 * play() MUST run synchronously in the pointer/touch handler — no await before it.
 */
function playPreparedInGesture(
  el: HTMLAudioElement,
  objectUrlRef: { current: string | null }
): Promise<void> {
  primeAudioElement(el);

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
    }, 2000);
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
  const [showTapToHear, setShowTapToHear] = useState(false);
  const [voiceDebug, setVoiceDebug] = useState<string | null>(null);

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
  /** After TTS, restart mic in wake (dormant) or command (open) mode. */
  const resumeModeRef = useRef<ListenMode>("command");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const openConversationRef = useRef<() => void>(() => {});
  const goDormantRef = useRef<() => void>(() => {});

  const unlockAudio = useCallback(async (): Promise<boolean> => {
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

    if (audioUnlockedRef.current) {
      if (synth) primeSpeechSynthesis(synth);
      return true;
    }

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
      setNeedsGesture(false);
      if (synth) {
        primeSpeechSynthesisInGesture(synth);
        void waitForSpeechVoices(synth, isSafariBrowser() ? 3000 : 1200);
      }
      return true;
    } catch {
      el.muted = false;
      setNeedsGesture(true);
      return false;
    }
  }, []);

  /**
   * Free device TTS when ElevenLabs is missing or out of credits.
   * On Safari after async work, throws — use speakWithFreeVoiceSync in a tap handler.
   */
  const speakWithFreeVoice = useCallback(async (text: string) => {
    if (needsSafariGesturePlayback()) {
      throw new NeedsGesturePlaybackError();
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
  }, [refreshStatus]);

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

  const prefetchVoiceUrl = useCallback((blob: Blob): string => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(normalizeAudioBlob(blob));
    objectUrlRef.current = url;
    const el = audioElRef.current;
    if (el) {
      primeAudioElement(el);
      el.src = url;
      el.load();
    }
    return url;
  }, []);

  const queueTapToHear = useCallback(
    (pending: PendingVoice) => {
      if (pending.blob && !pending.url && !pending.useBrowserTts) {
        pending.url = prefetchVoiceUrl(pending.blob);
      }
      pendingVoiceRef.current = pending;
      waitingForTapRef.current = true;
      setShowTapToHear(true);
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
      setVoiceDebug("tap: nothing pending");
      return;
    }

    gesturePlayLockRef.current = true;

    const snapshot: PendingVoice = { ...pending };
    pendingVoiceRef.current = null;
    waitingForTapRef.current = false;
    setShowTapToHear(false);
    setPhase("speaking");
    audioUnlockedRef.current = true;

    // Stop mic only — do not cancel speechSynthesis before MPEG play on Safari.
    killMic({ keepSpeech: Boolean(snapshot.blob && !snapshot.useBrowserTts) });

    let playback: Promise<void>;

    if (snapshot.blob && !snapshot.useBrowserTts) {
      if (snapshot.url) {
        objectUrlRef.current = snapshot.url;
        if (el.src !== snapshot.url) {
          primeAudioElement(el);
          el.src = snapshot.url;
        }
      } else {
        playback = playBlobInGesture(el, snapshot.blob, objectUrlRef);
        void playback
          .then(() => {
            setVoiceDebug(null);
            setError(null);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "play failed";
            setVoiceDebug(`tap: ${msg}`);
            pendingVoiceRef.current = snapshot;
            waitingForTapRef.current = true;
            setShowTapToHear(true);
            setError("Tap again to hear Nova's reply.");
          })
          .finally(() => {
            gesturePlayLockRef.current = false;
            resumeAfterSpeech(snapshot.after);
          });
        return;
      }
      playback = playPreparedInGesture(el, objectUrlRef);
    } else if (isNovaApk() && hasNativeTts()) {
      playback = speakWithNative(snapshot.text);
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      playback = speakWithFreeVoiceSync(snapshot.text);
    } else {
      gesturePlayLockRef.current = false;
      setVoiceDebug("tap: no playback path");
      pendingVoiceRef.current = snapshot;
      waitingForTapRef.current = true;
      setShowTapToHear(true);
      return;
    }

    void playback
      .then(() => {
        setVoiceDebug(null);
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "play failed";
        setVoiceDebug(`tap: ${msg}`);
        pendingVoiceRef.current = snapshot;
        waitingForTapRef.current = true;
        setShowTapToHear(true);
        setError("Tap again to hear Nova's reply.");
      })
      .finally(() => {
        gesturePlayLockRef.current = false;
        resumeAfterSpeech(snapshot.after);
      });
  }, [killMic, resumeAfterSpeech]);

  const onTapToHear = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      playPendingNow();
    },
    [playPendingNow]
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
          setError("Allow the microphone — Nova needs it to always listen.");
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

      try {
        if (!audioUnlockedRef.current) {
          await unlockAudio();
        }

        // Safari MPEG path: speechSynthesis.cancel() can block HTMLAudioElement.
        if (!needsSafariGesturePlayback()) {
          stopNativeTts();
          window.speechSynthesis?.cancel();
        }

        const fetched = await fetchVoiceAudio(text);
        voiceBlob = fetched.blob;
        useBrowserTts = fetched.useBrowserTts;
        if (fetched.debug) setVoiceDebug(fetched.debug);

        if (voiceBlob && !useBrowserTts) {
          prefetchedUrl = prefetchVoiceUrl(voiceBlob);
        }

        if (voiceBlob && !useBrowserTts && audioElRef.current) {
          try {
            await playBlobOnElement(
              audioElRef.current,
              voiceBlob,
              objectUrlRef
            );
            setVoiceDebug(null);
            setError(null);
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "autoplay failed";
            setVoiceDebug(`auto: ${msg}`);
          }
        }

        if (needsSafariGesturePlayback()) {
          queueTapToHear({
            text,
            blob: voiceBlob,
            url: prefetchedUrl,
            after,
            useBrowserTts: useBrowserTts || !voiceBlob,
          });
          setPhase("speaking");
          setError(null);
          return;
        }

        if (useBrowserTts || !voiceBlob) {
          await speakWithFreeVoice(text);
          setVoiceDebug(null);
          setError(null);
          return;
        }

        await playVoiceBlob(voiceBlob);
        setVoiceDebug(null);
        setError(null);
      } catch (err) {
        if (needsSafariGesturePlayback()) {
          queueTapToHear({
            text,
            blob: voiceBlob,
            url: prefetchedUrl,
            after,
            useBrowserTts: useBrowserTts || !voiceBlob,
          });
          setPhase("speaking");
          setError(null);
          return;
        }
        try {
          await speakWithFreeVoice(text);
          setVoiceDebug(null);
          setError(null);
        } catch (fallbackErr) {
          const msg = err instanceof Error ? err.message : "Voice failed";
          const fbMsg =
            fallbackErr instanceof Error ? fallbackErr.message : "";
          setVoiceDebug(`err: ${msg}${fbMsg ? ` / ${fbMsg}` : ""}`);
          if (
            /NotAllowed|interact|gesture|play blocked/i.test(msg) ||
            /NotAllowed|interact|gesture|play blocked|did not start/i.test(fbMsg)
          ) {
            setNeedsGesture(true);
            setError("Tap the orb once to unlock sound, then try again.");
          } else if (/no free device voice|Native voice bridge/i.test(fbMsg)) {
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
    ? "muted — tap to wake"
    : phase === "idle"
      ? "starting…"
      : phase === "listening_wake"
        ? "say “hey nova”"
        : phase === "listening_command"
          ? "listening — no wake needed"
          : phase === "thinking"
            ? "thinking"
            : phase === "speaking"
              ? "speaking"
              : "";

  return (
    <div
      className="nova-shell"
      onPointerDown={() => {
        void unlockAudio();
      }}
    >
      <audio
        ref={audioElRef}
        playsInline
        preload="auto"
        className="nova-audio-hidden"
      />
      <div className="nova-void" aria-hidden />
      <div className="nova-stars" aria-hidden />
      <div className="nova-vignette" aria-hidden />

      <header className="nova-top">
        <div className="nova-top-inner">
          <div className="flex flex-col gap-2">
            <Link href="/nexus" className="nova-link">
              Nexus
            </Link>
            <Link href="/nova/download" className="nova-link">
              Get APK
            </Link>
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
                {status?.novaArmed ? "Armed" : "Paused"} ·{" "}
                {status?.dailyTarget ?? "—"}/day
              </span>
            </div>
            <div className="nova-meta-dim">
              Send {status?.sendEnabled ? "on" : "off"}
              {status?.mailtrapConfigured ? "" : " · no Mailtrap"}
              {status && !status.voiceConfigured
                ? " · free device voice"
                : status?.voiceConfigured
                  ? " · ElevenLabs (+ free fallback)"
                  : ""}
            </div>
            <div className="nova-meta-dim">
              Signups {status?.conversionsMatched ?? 0}
              {status?.sentInWindow != null
                ? ` / ${status.sentInWindow} sent`
                : ""}
              {status?.conversionRate != null
                ? ` · ${status.conversionRate}%`
                : ""}
              {(status?.subscribedCount ?? 0) > 0
                ? ` · ${status?.subscribedCount} subscribed`
                : ""}
            </div>
          </div>
        </div>
      </header>

      <main className="nova-stage">
        <h1 className="nova-brand font-display">NOVA</h1>
        <p className="nova-tagline">
          Say <span>“Hey Nova”</span> to start. After that, just talk — she
          stops when you’re done.
        </p>

        <div className={wrapClass}>
          <span className="nova-orb-halo nova-orb-halo-a" aria-hidden />
          <span className="nova-orb-halo nova-orb-halo-b" aria-hidden />
          <NovaMeshOrb
            phase={phase}
            onClick={toggleListening}
            onPointerDown={() => {
              void unlockAudio();
            }}
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
        {needsGesture && (
          <p className="nova-hint">
            Tap the orb once to unlock sound, then talk to Nova.
          </p>
        )}
        {voiceDebug && (
          <p className="nova-voice-debug" aria-live="polite">
            voice: {voiceDebug}
          </p>
        )}
        {!micSupported && (
          <p className="nova-hint">
            Wake word unavailable here — use the keyboard.
          </p>
        )}
      </main>

      {showTapToHear && (
        <button
          type="button"
          className="nova-tap-hear-fixed"
          onPointerDown={onTapToHear}
          onClick={(e) => e.preventDefault()}
        >
          Tap to hear Nova
        </button>
      )}

      <footer className="nova-dock">
        <div className="nova-transcript" ref={transcriptRef}>
          {lines.length === 0 && (
            <p className="text-center text-sm text-white/25">
              Say “Hey Nova” when you want her. Ambient talk is ignored.
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
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}

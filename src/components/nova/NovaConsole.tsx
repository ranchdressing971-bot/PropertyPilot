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
  }
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
  /** After TTS, restart mic in wake (dormant) or command (open) mode. */
  const resumeModeRef = useRef<ListenMode>("command");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const openConversationRef = useRef<() => void>(() => {});
  const goDormantRef = useRef<() => void>(() => {});

  const unlockAudio = useCallback(() => {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
      }
    } catch {
      /* ignore */
    }

    const el = audioElRef.current;
    if (!el) return;
    if (audioUnlockedRef.current) return;

    // Warm the persistent <audio> inside a user gesture so later TTS can play.
    try {
      el.muted = true;
      el.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      void el
        .play()
        .then(() => {
          el.pause();
          el.muted = false;
          el.removeAttribute("src");
          el.load();
          audioUnlockedRef.current = true;
          setNeedsGesture(false);
        })
        .catch(() => {
          el.muted = false;
        });
    } catch {
      /* ignore */
    }
  }, []);

  /** Free device TTS (Web Speech API) when ElevenLabs is missing or out of credits. */
  const speakWithBrowser = useCallback(async (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      throw new Error("This browser has no free device voice.");
    }
    const clipped = text.trim().slice(0, 2500);
    if (!clipped) return;

    await new Promise<void>((resolve) => {
      const ready = window.speechSynthesis.getVoices();
      if (ready.length > 0) {
        resolve();
        return;
      }
      const onVoices = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve();
      }, 600);
    });

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clipped);
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) =>
        /samantha|karen|moira|victoria|susan|zira|google us english|Samantha/i.test(
          v.name
        )
      ) ||
      voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.05;
    utterance.pitch = 1.08;
    utterance.volume = 1;

    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error === "interrupted" || event.error === "canceled") {
          resolve();
          return;
        }
        reject(new Error(event.error || "Device voice failed"));
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const playVoiceBlob = useCallback(async (blob: Blob) => {
    const el = audioElRef.current;
    if (!el) throw new Error("Audio element missing");

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    el.muted = false;
    el.src = url;
    el.load();

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        el.onended = null;
        el.onerror = null;
      };
      el.onended = () => {
        cleanup();
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
        }
        resolve();
      };
      el.onerror = () => {
        cleanup();
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
        }
        reject(new Error("Browser could not play the voice file"));
      };
      void el.play().catch((err: unknown) => {
        cleanup();
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
        }
        const msg = err instanceof Error ? err.message : "play blocked";
        reject(new Error(msg));
      });
    });
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
  const killMic = useCallback(() => {
    restartingRef.current = true;
    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
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
      unlockAudio();
      try {
        if (typeof window !== "undefined") {
          window.speechSynthesis?.cancel();
        }
        const res = await fetch("/api/nova/speak", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        // Missing key, out of credits, or rate limit → free device voice.
        if (res.status === 503) {
          let code = "";
          try {
            const data = (await res.json()) as { code?: string; error?: string };
            code = data.code ?? "";
          } catch {
            /* ignore */
          }
          if (code === "FALLBACK_BROWSER" || !code) {
            await speakWithBrowser(text);
            setError(null);
            return;
          }
          setError(
            "Voice off — add ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID on Vercel, redeploy."
          );
          return;
        }

        if (!res.ok) {
          // Any ElevenLabs failure: try free voice before surfacing an error.
          try {
            await speakWithBrowser(text);
            setError(null);
            return;
          } catch {
            /* fall through */
          }
          let detail = "Voice request failed";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) detail = data.error;
          } catch {
            /* ignore */
          }
          setError(detail);
          return;
        }
        const blob = await res.blob();
        if (!blob.size) {
          await speakWithBrowser(text);
          return;
        }
        // Ensure MPEG type — some browsers refuse generic blobs.
        const typed =
          blob.type && blob.type !== "application/octet-stream"
            ? blob
            : new Blob([blob], { type: "audio/mpeg" });
        try {
          await playVoiceBlob(typed);
        } catch {
          await speakWithBrowser(text);
        }
      } catch (err) {
        try {
          await speakWithBrowser(text);
          setError(null);
        } catch {
          const msg = err instanceof Error ? err.message : "Voice failed";
          if (/play|NotAllowed|interact/i.test(msg)) {
            setNeedsGesture(true);
            setError("Tap the orb once to unlock sound, then try again.");
          } else {
            setError(msg);
          }
        }
      } finally {
        const mode = resumeModeRef.current;
        setPhase(mode === "command" ? "listening_command" : "listening_wake");
        // Fresh mic session after TTS — old one is dead after killMic.
        window.setTimeout(() => {
          if (listeningOnRef.current) startMicRef.current(mode);
        }, 350);
      }
    },
    [killMic, playVoiceBlob, speakWithBrowser, unlockAudio]
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
    unlockAudio();
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

      unlockAudio();
      setError(null);
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
    unlockAudio();
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
    unlockAudio();
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
      onPointerDown={unlockAudio}
    >
      <audio ref={audioElRef} playsInline preload="auto" className="hidden" />
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
              {status && !status.voiceConfigured ? " · voice missing" : ""}
            </div>
            <div className="nova-meta-dim">
              Signups {status?.conversionsMatched ?? 0}
              {status?.sentInWindow != null
                ? ` / ${status.sentInWindow} sent`
                : ""}
              {status?.conversionRate != null
                ? ` · ${status.conversionRate}%`
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
            Tap the orb once to unlock mic + sound.
          </p>
        )}
        {!micSupported && (
          <p className="nova-hint">
            Wake word unavailable here — use the keyboard.
          </p>
        )}
      </main>

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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

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

/** True when the utterance is only the wake word (no real command yet). */
function isWakeOnly(text: string): boolean {
  const rest = stripWake(text);
  if (rest.length >= 2) return false;
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
  return /^(hey )?nova$/.test(cleaned);
}

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
  const commandDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const audioUnlockedRef = useRef(false);
  /** After TTS, restart mic in wake or command mode. */
  const resumeModeRef = useRef<ListenMode>("wake");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const acknowledgeWakeRef = useRef<() => void>(() => {});

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const clearCommandDeadline = useCallback(() => {
    if (commandDeadlineRef.current) {
      clearTimeout(commandDeadlineRef.current);
      commandDeadlineRef.current = null;
    }
  }, []);

  const armCommandDeadline = useCallback(() => {
    clearCommandDeadline();
    // If they only said "Hey Nova", wait for the real ask — then fall back.
    commandDeadlineRef.current = setTimeout(() => {
      if (phaseRef.current === "listening_command") {
        setPhase("listening_wake");
        resumeModeRef.current = "wake";
        startMicRef.current("wake");
      }
    }, 10000);
  }, [clearCommandDeadline]);

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

      setPhase(mode === "command" ? "listening_command" : "listening_wake");
      if (mode === "command") armCommandDeadline();
      else clearCommandDeadline();

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

        if (phaseRef.current === "listening_wake") {
          if (!containsWake(text)) return;

          // Wake word only — acknowledge and keep listening for the ask.
          if (isWakeOnly(text) || stripWake(text).length < 2) {
            if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
            commandBufferRef.current = "";
            acknowledgeWakeRef.current();
            return;
          }

          beep();
          setPhase("listening_command");
          armCommandDeadline();
          const rest = stripWake(text);
          commandBufferRef.current = rest;
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          if (rest.length > 6 && isFinal) {
            clearCommandDeadline();
            commandBufferRef.current = "";
            void askNovaRef.current(rest);
            return;
          }
          commandTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length >= 2) {
              clearCommandDeadline();
              commandBufferRef.current = "";
              void askNovaRef.current(cmd);
            } else {
              acknowledgeWakeRef.current();
            }
          }, 1600);
          return;
        }

        if (phaseRef.current === "listening_command") {
          // Ignore a second bare wake while already listening for the command
          if (isWakeOnly(text)) {
            beep();
            armCommandDeadline();
            return;
          }
          const rest = stripWake(text) || text;
          if (rest.length < 2) return;
          commandBufferRef.current = rest;
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          commandTimerRef.current = setTimeout(() => {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length < 2) return;
            clearCommandDeadline();
            commandBufferRef.current = "";
            void askNovaRef.current(cmd);
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
    [armCommandDeadline, clearCommandDeadline, killMic]
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
        const res = await fetch("/api/nova/speak", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.status === 503) {
          setError(
            "Voice off — add ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID on Vercel, redeploy."
          );
          return;
        }
        if (!res.ok) {
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
          setError("Voice returned empty audio.");
          return;
        }
        // Ensure MPEG type — some browsers refuse generic blobs.
        const typed =
          blob.type && blob.type !== "application/octet-stream"
            ? blob
            : new Blob([blob], { type: "audio/mpeg" });
        await playVoiceBlob(typed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Voice failed";
        if (/play|NotAllowed|interact/i.test(msg)) {
          setNeedsGesture(true);
          setError("Tap the orb once to unlock sound, then try again.");
        } else {
          setError(msg);
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
    [killMic, playVoiceBlob, unlockAudio]
  );

  const acknowledgeWake = useCallback(() => {
    unlockAudio();
    beep();
    setPhase("listening_command");
    armCommandDeadline();
    // Short ack, then keep listening for the real question.
    void speak("Hey.", "command");
  }, [armCommandDeadline, speak, unlockAudio]);

  useEffect(() => {
    acknowledgeWakeRef.current = acknowledgeWake;
  }, [acknowledgeWake]);

  const askNova = useCallback(
    async (message: string) => {
      const cleaned = message.trim();
      if (!cleaned || isWakeOnly(cleaned)) {
        acknowledgeWake();
        return;
      }

      unlockAudio();
      setError(null);
      clearCommandDeadline();
      setPhase("thinking");
      killMic();
      resumeModeRef.current = "wake";

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
        await speak(reply, "wake");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nova failed";
        setError(msg);
        setPhase("listening_wake");
        window.setTimeout(() => {
          if (listeningOnRef.current) startMicRef.current("wake");
        }, 350);
      }
    },
    [
      acknowledgeWake,
      clearCommandDeadline,
      killMic,
      refreshStatus,
      speak,
      unlockAudio,
    ]
  );

  useEffect(() => {
    askNovaRef.current = askNova;
  }, [askNova]);

  // Always-on on mount
  useEffect(() => {
    listeningOnRef.current = true;
    setListeningOn(true);
    startMic("wake");
    return () => {
      listeningOnRef.current = false;
      killMic();
      clearCommandDeadline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const toggleListening = () => {
    unlockAudio();
    if (listeningOn) {
      setListeningOn(false);
      listeningOnRef.current = false;
      killMic();
      clearCommandDeadline();
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

  const orbClass =
    phase === "listening_wake"
      ? "nova-orb nova-orb-wake"
      : phase === "listening_command"
        ? "nova-orb nova-orb-command"
        : phase === "thinking"
          ? "nova-orb nova-orb-think"
          : phase === "speaking"
            ? "nova-orb nova-orb-speak"
            : "nova-orb";

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
        ? "listening for nova"
        : phase === "listening_command"
          ? "go ahead"
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
      <div className="nova-aurora" aria-hidden />
      <div className="nova-grid" aria-hidden />
      <div className="nova-vignette" aria-hidden />

      <header className="nova-top">
        <div className="nova-top-inner">
          <Link
            href="/nexus"
            className="text-[11px] uppercase tracking-[0.28em] text-teal-200/45 transition hover:text-teal-100/80"
          >
            Nexus
          </Link>
          <div className="flex flex-col items-end gap-1.5 text-[11px] tracking-wide text-teal-100/55">
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
            <div className="text-right text-teal-100/35">
              Send {status?.sendEnabled ? "on" : "off"}
              {status?.mailtrapConfigured ? "" : " · no Mailtrap"}
              {status && !status.voiceConfigured ? " · voice missing" : ""}
            </div>
          </div>
        </div>
      </header>

      <main className="nova-stage">
        <h1 className="nova-brand font-display">NOVA</h1>
        <p className="nova-tagline">
          Say <span>“Hey Nova”</span> — she answers and keeps listening.
        </p>

        <div className="nova-orb-wrap">
          <span className="nova-ring nova-ring-a" aria-hidden />
          <span className="nova-ring nova-ring-b" aria-hidden />
          <span className="nova-ring nova-ring-c" aria-hidden />
          <button
            type="button"
            onClick={toggleListening}
            className={orbClass}
            aria-label={
              listeningOn ? "Mute Nova mic" : "Enable always-on listening"
            }
          >
            <span className="nova-orb-core" />
          </button>
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
        <div className="nova-transcript">
          {lines.length === 0 && (
            <p className="text-center text-sm text-teal-100/30">
              Waiting for your voice…
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
                    ? "text-[10px] uppercase tracking-[0.2em] text-teal-300/35"
                    : "text-[10px] uppercase tracking-[0.2em] text-teal-300/50"
                }
              >
                {line.role === "user" ? "You" : "Nova"}
              </div>
              <p
                className={
                  line.role === "user"
                    ? "mt-1 text-sm leading-relaxed text-teal-100/70"
                    : "mt-1 font-display text-[1.05rem] leading-snug tracking-tight text-teal-50"
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

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const audioUnlockedRef = useRef(false);
  /** After TTS, restart mic in wake or command mode. */
  const resumeModeRef = useRef<ListenMode>("wake");
  const askNovaRef = useRef<(message: string) => Promise<void>>(async () => {});
  const startMicRef = useRef<(mode?: ListenMode) => void>(() => {});
  const acknowledgeWakeRef = useRef<() => void>(() => {});

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      );
      a.volume = 0.01;
      void a
        .play()
        .then(() => {
          a.pause();
          audioUnlockedRef.current = true;
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
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
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            setError(
              "Browser could not play the voice file. Tap the orb, check volume, try Chrome."
            );
            URL.revokeObjectURL(url);
            resolve();
          };
          void audio.play().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "play blocked";
            setError(
              `Browser blocked playback (${msg}). Tap the orb once to unlock sound.`
            );
            URL.revokeObjectURL(url);
            resolve();
          });
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice failed");
      } finally {
        const mode = resumeModeRef.current;
        setPhase(mode === "command" ? "listening_command" : "listening_wake");
        // Fresh mic session after TTS — old one is dead after killMic.
        window.setTimeout(() => {
          if (listeningOnRef.current) startMicRef.current(mode);
        }, 350);
      }
    },
    [killMic]
  );

  const acknowledgeWake = useCallback(() => {
    beep();
    setPhase("listening_command");
    armCommandDeadline();
    // Short ack, then keep listening for the real question.
    void speak("Hey.", "command");
  }, [armCommandDeadline, speak]);

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

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,#0f3d3a_0%,#061312_55%,#030807_100%)] text-teal-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(94,234,212,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(94,234,212,0.15)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        aria-hidden
      />
      <header className="relative z-10 flex items-start justify-between gap-4 px-6 pt-8 sm:px-10">
        <div>
          <Link
            href="/nexus"
            className="text-xs uppercase tracking-[0.2em] text-teal-200/60 hover:text-teal-100"
          >
            Nexus tools
          </Link>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[0.18em] text-teal-50 sm:text-5xl">
            NOVA
          </h1>
          <p className="mt-2 max-w-md text-sm text-teal-100/55">
            Always listening — say{" "}
            <span className="text-teal-100/90">“Hey Nova…”</span> like Alexa.
          </p>
        </div>
        <div className="rounded-lg border border-teal-400/20 bg-black/30 px-3 py-2 text-right text-[11px] leading-relaxed text-teal-100/70">
          <div>
            Mic{" "}
            <strong className="text-teal-50">
              {listeningOn ? "ALWAYS ON" : "MUTED"}
            </strong>
          </div>
          <div>
            Nova{" "}
            <strong className="text-teal-50">
              {status?.novaArmed ? "ARMED" : "PAUSED"}
            </strong>
            {" · "}
            target {status?.dailyTarget ?? "—"}/day
          </div>
          <div>
            Env send {status?.sendEnabled ? "ON" : "OFF"}
            {status?.mailtrapConfigured ? "" : " · no Mailtrap"}
            {status && !status.voiceConfigured ? " · voice key missing" : ""}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        <button
          type="button"
          onClick={toggleListening}
          className={orbClass}
          aria-label={listeningOn ? "Mute Nova mic" : "Enable always-on listening"}
        >
          <span className="nova-orb-core" />
        </button>
        <p className="mt-6 text-xs uppercase tracking-[0.25em] text-teal-200/50">
          {!listeningOn && "muted — tap orb to listen"}
          {listeningOn && phase === "idle" && "starting mic…"}
          {listeningOn && phase === "listening_wake" && "listening for “nova”"}
          {listeningOn && phase === "listening_command" && "go ahead — i'm listening"}
          {phase === "thinking" && "thinking"}
          {phase === "speaking" && "speaking"}
        </p>
        {needsGesture && (
          <p className="mt-2 text-xs text-amber-200/90">
            Browser needs a tap — hit the orb once to unlock always-on.
          </p>
        )}
        {!micSupported && (
          <p className="mt-2 text-xs text-amber-200/80">
            Wake word unavailable here — use the keyboard.
          </p>
        )}
      </div>

      <section className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-6 pb-4 sm:px-10">
        <div className="nova-transcript max-h-56 space-y-3 overflow-y-auto pr-1">
          {lines.length === 0 && (
            <p className="text-sm text-teal-100/40">
              Say “Hey Nova” — she’ll answer “Hey” and keep listening.
            </p>
          )}
          {lines.map((line) => (
            <div
              key={line.id}
              className={
                line.role === "user"
                  ? "text-sm text-teal-100/80"
                  : "text-sm text-teal-50"
              }
            >
              <span className="mr-2 text-[10px] uppercase tracking-wider text-teal-300/40">
                {line.role === "user" ? "You" : "Nova"}
              </span>
              {line.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {error && <p className="mt-3 text-xs text-rose-300/90">{error}</p>}
      </section>

      <form
        onSubmit={onSubmit}
        className="relative z-10 mx-auto flex w-full max-w-2xl gap-2 px-6 pb-10 sm:px-10"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Or type to Nova…"
          className="flex-1 rounded-md border border-teal-400/25 bg-black/40 px-4 py-3 text-sm text-teal-50 placeholder:text-teal-200/30 focus:border-teal-300/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={phase === "thinking"}
          className="rounded-md bg-teal-400/20 px-4 py-3 text-sm font-medium text-teal-50 hover:bg-teal-400/30 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

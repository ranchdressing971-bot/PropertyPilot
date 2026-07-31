"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Phase = "idle" | "listening_wake" | "listening_command" | "thinking" | "speaking";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface StatusPayload {
  sendEnabled: boolean;
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
  return text
    .replace(/^(hey\s+)?nova[,.\s!]*/i, "")
    .trim();
}

function containsWake(text: string): boolean {
  return /\b(hey\s+)?nova\b/i.test(text);
}

export function NovaConsole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);
  const [wakeArmed, setWakeArmed] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  const wakeArmedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const commandBufferRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    wakeArmedRef.current = wakeArmed;
  }, [wakeArmed]);

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

  const speak = useCallback(async (text: string) => {
    setPhase("speaking");
    try {
      const res = await fetch("/api/nova/speak", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503) {
        setPhase("idle");
        return;
      }
      if (!res.ok) {
        setPhase("idle");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    } finally {
      setPhase("idle");
    }
  }, []);

  const askNova = useCallback(
    async (message: string) => {
      const cleaned = message.trim();
      if (!cleaned) return;

      setError(null);
      setPhase("thinking");
      const userLine: ChatLine = {
        id: `u-${Date.now()}`,
        role: "user",
        content: cleaned,
      };
      setLines((prev) => [...prev, userLine]);

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
        await speak(reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nova failed";
        setError(msg);
        setPhase("idle");
      }
    },
    [refreshStatus, speak]
  );

  const stopWake = useCallback(() => {
    setWakeArmed(false);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setPhase("idle");
  }, []);

  const startWake = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setMicSupported(false);
      setError("This browser has no SpeechRecognition — type to Nova instead.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    setWakeArmed(true);
    setPhase("listening_wake");
    setError(null);
    commandBufferRef.current = "";

    recognition.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunk += event.results[i][0]?.transcript ?? "";
      }
      const text = chunk.trim();
      if (!text) return;

      if (phaseRef.current === "listening_wake") {
        if (containsWake(text)) {
          setPhase("listening_command");
          const rest = stripWake(text);
          commandBufferRef.current = rest;
          // Short beep via oscillator
          try {
            const ctx = new AudioContext();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = 880;
            g.gain.value = 0.04;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.08);
          } catch {
            /* ignore */
          }
          if (rest.length > 8 && event.results[event.results.length - 1]?.isFinal) {
            recognition.stop();
            void askNova(rest);
          }
        }
        return;
      }

      if (phaseRef.current === "listening_command") {
        const rest = stripWake(text) || text;
        commandBufferRef.current = rest;
        if (event.results[event.results.length - 1]?.isFinal && rest.length > 2) {
          recognition.stop();
          void askNova(rest);
        }
      }
    };

    recognition.onerror = (ev) => {
      if (ev.error === "not-allowed") {
        setError("Mic blocked — allow microphone for wake word, or type.");
        setWakeArmed(false);
        setPhase("idle");
      }
    };

    recognition.onend = () => {
      if (
        wakeArmedRef.current &&
        (phaseRef.current === "listening_wake" ||
          phaseRef.current === "listening_command")
      ) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setError("Could not start microphone.");
      setWakeArmed(false);
      setPhase("idle");
    }
  }, [askNova]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            Outreach manager. Say{" "}
            <span className="text-teal-100/90">“Hey Nova”</span> or type.
          </p>
        </div>
        <div className="rounded-lg border border-teal-400/20 bg-black/30 px-3 py-2 text-right text-[11px] leading-relaxed text-teal-100/70">
          <div>
            Send{" "}
            <strong className="text-teal-50">
              {status?.sendEnabled ? "ON" : "OFF"}
            </strong>
            {status?.mailtrapSandbox ? " · sandbox" : ""}
          </div>
          <div>
            Queue {status?.queuedJobs ?? "—"} · Approved{" "}
            {status?.approvedDrafts ?? "—"} · Sent {status?.sentDrafts ?? "—"}
          </div>
          <div>
            Leads {status?.companies ?? "—"}
            {status?.voiceConfigured ? "" : " · voice unset"}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        <button
          type="button"
          onClick={() => (wakeArmed ? stopWake() : startWake())}
          className={orbClass}
          aria-label={wakeArmed ? "Stop listening for Nova" : "Listen for Nova"}
        >
          <span className="nova-orb-core" />
        </button>
        <p className="mt-6 text-xs uppercase tracking-[0.25em] text-teal-200/50">
          {phase === "idle" && (wakeArmed ? "armed" : "standby — tap orb")}
          {phase === "listening_wake" && "listening for “nova”"}
          {phase === "listening_command" && "go ahead…"}
          {phase === "thinking" && "thinking"}
          {phase === "speaking" && "speaking"}
        </p>
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
              Try: “Hey Nova, how are the emails going?”
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
        {error && (
          <p className="mt-3 text-xs text-rose-300/90">{error}</p>
        )}
      </section>

      <form
        onSubmit={onSubmit}
        className="relative z-10 mx-auto flex w-full max-w-2xl gap-2 px-6 pb-10 sm:px-10"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Nova…"
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

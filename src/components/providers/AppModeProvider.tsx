"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppMode, MODE_STORAGE_KEY } from "@/lib/app-mode";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isDemo: boolean;
  isLive: boolean;
  ready: boolean;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

function persistMode(mode: AppMode) {
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  document.cookie = `pp-mode=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("demo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("mode");
    const stored = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;

    // /demo sets the cookie; honor cookie or ?mode=demo for share links
    const cookieMatch = document.cookie.match(/(?:^|; )pp-mode=(demo|live)/);
    const fromCookie = cookieMatch?.[1] as AppMode | undefined;

    const next =
      fromQuery === "demo" || fromQuery === "live"
        ? fromQuery
        : fromCookie === "demo" || fromCookie === "live"
          ? fromCookie
          : stored === "demo" || stored === "live"
            ? stored
            : "demo";

    setModeState(next);
    persistMode(next);
    setReady(true);
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    persistMode(next);
  }, []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode,
        isDemo: mode === "demo",
        isLive: mode === "live",
        ready,
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}

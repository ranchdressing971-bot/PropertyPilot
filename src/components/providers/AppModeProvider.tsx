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
    const stored = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
    if (stored === "demo" || stored === "live") {
      setModeState(stored);
    }
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

"use client";

import { useContext, useRef } from "react";
import { usePathname } from "next/navigation";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

/**
 * Freeze the App Router layout context for the lifetime of this keyed panel.
 * Without this, Next can swap `children` to the next route while the exiting
 * motion node is still mounted — so new content flashes at full opacity before
 * the exit/enter spring runs.
 */
function FrozenRoute({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const frozen = useRef(context).current;

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

/**
 * Animates on client-side route changes (sidebar / links), not only full refresh.
 * Must sit inside a persistent layout so exit/enter can run across navigations.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        exit={pageTransition.exit}
        transition={pageTransition.transition}
        // CSS matches `initial` so the first paint is hidden even if Motion
        // applies `initial` one frame late after a soft navigation remount.
        className="page-transition w-full"
      >
        <FrozenRoute>{children}</FrozenRoute>
      </motion.div>
    </AnimatePresence>
  );
}

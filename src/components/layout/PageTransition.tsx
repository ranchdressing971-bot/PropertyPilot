"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

/**
 * Soft enter-only transition on client-side route changes.
 *
 * Exit animations + AnimatePresence are intentionally omitted: with the App
 * Router, layout `children` swap to the destination before the old keyed panel
 * unmounts, so an exit fade runs on the NEW page (fade out → fade in). Enter-only
 * keeps navigations subtle without that double fade.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransition.transition}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

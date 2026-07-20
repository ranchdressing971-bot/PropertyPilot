/** Soft route transitions (dashboard / public shell) — enter only, no exit. */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.25,
    ease: [0.25, 0.1, 0.25, 1] as const,
  },
};

/** Shared entrance motion — strong enough to see on first paint. */
export const popIn = {
  initial: { opacity: 0, y: 40, scale: 0.88 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: (delay = 0) => ({
    delay,
    type: "spring" as const,
    stiffness: 260,
    damping: 18,
    mass: 0.9,
  }),
};

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: (delay = 0) => ({
    delay,
    type: "spring" as const,
    stiffness: 280,
    damping: 20,
  }),
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.12,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 28, scale: 0.92 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 18 },
  },
};

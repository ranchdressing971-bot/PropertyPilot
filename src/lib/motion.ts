/** Soft route transitions (dashboard / public shell). */
export const pageTransition = {
  initial: { opacity: 0, y: 22, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: {
    type: "spring" as const,
    stiffness: 300,
    damping: 26,
    mass: 0.85,
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

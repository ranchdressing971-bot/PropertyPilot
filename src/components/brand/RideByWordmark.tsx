import Image from "next/image";
import clsx from "clsx";

interface RideByWordmarkProps {
  className?: string;
  /** Text color for “ideBy” */
  variant?: "dark" | "light" | "inherit";
  /** Extra class on the logo tile (the R) */
  markClassName?: string;
  /** Invert mark colors (e.g. dark sidebar chrome) */
  inverted?: boolean;
}

/**
 * Brand wordmark: logo tile replaces the letter R → [mark]ideBy.
 * No standalone logo beside the name.
 */
export function RideByWordmark({
  className,
  variant = "dark",
  markClassName,
  inverted = false,
}: RideByWordmarkProps) {
  const textColor =
    variant === "light"
      ? "text-white"
      : variant === "inherit"
        ? "text-inherit"
        : "text-ink-900";

  return (
    <span
      role="img"
      aria-label="RideBy"
      className={clsx(
        "inline-flex items-center font-display font-semibold tracking-tight",
        textColor,
        className
      )}
    >
      <span
        className={clsx(
          "relative -mr-[0.04em] inline-flex shrink-0 overflow-hidden rounded-[22%]",
          "h-[1.32em] w-[1.32em] translate-y-[0.02em]",
          inverted && "invert",
          markClassName
        )}
        aria-hidden
      >
        <Image
          src="/logo.png"
          alt=""
          width={128}
          height={128}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      <span aria-hidden>ideBy</span>
    </span>
  );
}

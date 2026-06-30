import Link from "next/link";
import clsx from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: "dark" | "light";
}

const sizes = {
  sm: { text: "text-base" },
  md: { text: "text-lg" },
  lg: { text: "text-xl" },
};

/**
 * Text-only brand mark for in-app surfaces (dashboard, auth).
 * The image logo is reserved for the marketing homepage / device homescreen.
 */
export function Logo({
  size = "md",
  showText = true,
  href = "/",
  className,
  variant = "dark",
}: LogoProps) {
  const { text } = sizes[size];

  const content = (
    <div className={clsx("flex items-center gap-2", className)}>
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold",
          variant === "light"
            ? "bg-white/10 text-copper-400"
            : "bg-ink-900 text-white"
        )}
        aria-hidden
      >
        P
      </span>
      {showText && (
        <span
          className={clsx(
            "font-display font-semibold tracking-tight",
            variant === "light" ? "text-white" : "text-ink-900",
            text
          )}
        >
          Property Pilot
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}

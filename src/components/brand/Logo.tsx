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
  sm: { text: "text-base", icon: "h-7 w-7 text-xs" },
  md: { text: "text-lg", icon: "h-8 w-8 text-sm" },
  lg: { text: "text-xl", icon: "h-9 w-9 text-sm" },
};

export function Logo({
  size = "md",
  showText = true,
  href = "/",
  className,
  variant = "dark",
}: LogoProps) {
  const { text, icon } = sizes[size];

  const content = (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-xl font-semibold",
          icon,
          variant === "light"
            ? "bg-brand-600 text-white shadow-sm"
            : "bg-ink-900 text-white shadow-sm"
        )}
        aria-hidden
      >
        P
      </span>
      {showText && (
        <span
          className={clsx(
            "font-semibold tracking-tight",
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

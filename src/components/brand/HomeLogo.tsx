import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

interface HomeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  href?: string;
  className?: string;
}

const sizes = {
  sm: { icon: 36, text: "text-base" },
  md: { icon: 44, text: "text-lg" },
  lg: { icon: 56, text: "text-xl sm:text-2xl" },
  xl: { icon: 96, text: "text-3xl" },
};

/**
 * Marketing / homescreen logo only — not used inside the dashboard app.
 * Adapts to light and dark system themes via separate image assets.
 */
export function HomeLogo({
  size = "md",
  showText = true,
  href = "/",
  className,
}: HomeLogoProps) {
  const { icon, text } = sizes[size];

  const content = (
    <div className={clsx("flex items-center gap-3", className)}>
      <picture>
        <source
          srcSet="/logo-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <Image
          src="/logo.png"
          alt="Property Pilot"
          width={icon}
          height={icon}
          className="shrink-0 rounded-xl object-contain"
          priority
        />
      </picture>
      {showText && (
        <span
          className={clsx(
            "font-display font-semibold tracking-tight text-ink-900 dark:text-ink-100",
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

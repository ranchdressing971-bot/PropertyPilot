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
      <span
        className="relative inline-flex shrink-0 overflow-hidden rounded-[22%]"
        style={{ width: icon, height: icon }}
      >
        <Image
          src="/logo.png"
          alt="RideBy"
          width={icon}
          height={icon}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {showText && (
        <span
          className={clsx(
            "font-display font-semibold tracking-tight text-ink-900",
            text
          )}
        >
          RideBy
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label="RideBy home">
        {content}
      </Link>
    );
  }

  return content;
}

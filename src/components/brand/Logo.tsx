import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: "dark" | "light";
}

const sizes = {
  sm: { icon: 32, text: "text-base" },
  md: { icon: 36, text: "text-lg" },
  lg: { icon: 48, text: "text-xl sm:text-2xl" },
  xl: { icon: 80, text: "text-2xl" },
};

export function Logo({
  size = "md",
  showText = true,
  href = "/",
  className,
  variant = "dark",
}: LogoProps) {
  const { icon, text } = sizes[size];

  const content = (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="Property Pilot"
        width={icon}
        height={icon}
        className="shrink-0 object-contain"
        priority
      />
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

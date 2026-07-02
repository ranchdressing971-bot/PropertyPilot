import Image from "next/image";
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
  sm: { text: "text-base", icon: 28 },
  md: { text: "text-lg", icon: 32 },
  lg: { text: "text-xl", icon: 36 },
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
          "relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-black",
          variant === "light" && "ring-white"
        )}
        style={{ width: icon, height: icon }}
        aria-hidden
      >
        <Image
          src="/logo.png"
          alt=""
          width={icon}
          height={icon}
          className="h-full w-full object-cover"
          priority
        />
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
      <Link href={href} className="inline-flex shrink-0" aria-label="Property Pilot home">
        {content}
      </Link>
    );
  }

  return content;
}

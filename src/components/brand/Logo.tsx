import Link from "next/link";
import clsx from "clsx";
import { RideByWordmark } from "@/components/brand/RideByWordmark";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  /** @deprecated Wordmark always includes the name; kept for call-site compat. */
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: "dark" | "light";
}

const sizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function Logo({
  size = "md",
  href = "/",
  className,
  variant = "dark",
}: LogoProps) {
  const content = (
    <RideByWordmark
      variant={variant}
      className={clsx(sizes[size], className)}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label="RideBy home">
        <span aria-hidden className="inline-flex">
          {content}
        </span>
      </Link>
    );
  }

  return content;
}

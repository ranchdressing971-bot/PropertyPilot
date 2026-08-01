import Link from "next/link";
import clsx from "clsx";
import { RideByWordmark } from "@/components/brand/RideByWordmark";

interface HomeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  /** @deprecated Wordmark always includes the name; kept for call-site compat. */
  showText?: boolean;
  href?: string;
  className?: string;
}

const sizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl sm:text-3xl",
  xl: "text-4xl",
};

/**
 * Marketing wordmark — logo tile is the R in RideBy (no standalone icon).
 */
export function HomeLogo({
  size = "md",
  href = "/",
  className,
}: HomeLogoProps) {
  const content = (
    <RideByWordmark className={clsx(sizes[size], className)} />
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

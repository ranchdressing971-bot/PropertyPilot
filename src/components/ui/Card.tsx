import clsx from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "sm" | "md" | "lg" | "none";
}

export function Card({
  className,
  hover = false,
  padding = "md",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "surface",
        {
          "transition-colors hover:border-ink-300": hover,
          "p-4": padding === "sm",
          "p-5 sm:p-6": padding === "md",
          "p-6 sm:p-8": padding === "lg",
          "p-0": padding === "none",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

import clsx from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "sm" | "md" | "lg" | "none";
  glass?: boolean;
}

export function Card({
  className,
  hover = false,
  padding = "md",
  glass = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border shadow-sm",
        glass
          ? "glass-card"
          : "border-slate-200/70 bg-white/90 shadow-slate-200/40",
        {
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 transition-all duration-300":
            hover,
          "p-5": padding === "sm",
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

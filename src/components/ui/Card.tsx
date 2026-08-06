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
          "transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-card-hover":
            hover,
          "p-4": padding === "sm",
          "p-5": padding === "md",
          "p-6 sm:p-7": padding === "lg",
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

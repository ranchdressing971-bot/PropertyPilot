import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-copper-500/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          {
            "bg-ink-900 text-white hover:bg-ink-800": variant === "primary",
            "border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50":
              variant === "secondary",
            "text-ink-600 hover:bg-ink-100 hover:text-ink-900": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger",
            "px-3.5 py-2 text-sm min-h-[40px]": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-5 py-3 text-base w-full sm:w-auto": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

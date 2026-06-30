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
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          {
            "bg-ink-900 text-white shadow-sm hover:bg-ink-800 hover:shadow-md":
              variant === "primary",
            "border border-ink-200 bg-white text-ink-700 shadow-sm hover:border-ink-300 hover:bg-ink-50":
              variant === "secondary",
            "text-ink-600 hover:bg-ink-100 hover:text-ink-900": variant === "ghost",
            "bg-red-600 text-white shadow-sm hover:bg-red-700": variant === "danger",
            "px-3.5 py-2 text-sm min-h-[40px]": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3 text-base w-full sm:w-auto": size === "lg",
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

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
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
          {
            "bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-lg shadow-accent-600/25 hover:shadow-accent-600/40 hover:brightness-105":
              variant === "primary",
            "bg-white/90 text-slate-700 border border-slate-200/80 shadow-sm hover:bg-white hover:border-slate-300 hover:shadow-md":
              variant === "secondary",
            "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80":
              variant === "ghost",
            "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/25 hover:brightness-105":
              variant === "danger",
            "px-3 py-2 text-sm": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3.5 text-base": size === "lg",
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

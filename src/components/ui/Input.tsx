import clsx from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

export const inputClassName =
  "mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-900 shadow-sm placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(inputClassName, className)} {...props} />
  )
);

Input.displayName = "Input";

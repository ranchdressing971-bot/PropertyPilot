import clsx from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

export const inputClassName =
  "mt-1.5 h-11 w-full rounded-lg border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-copper-400 focus:outline-none focus:ring-2 focus:ring-copper-500/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(inputClassName, className)} {...props} />
  )
);

Input.displayName = "Input";

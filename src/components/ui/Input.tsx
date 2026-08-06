import clsx from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="label-field">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "input-field",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        {!error && hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
      </div>
    );
  }
);

Input.displayName = "Input";

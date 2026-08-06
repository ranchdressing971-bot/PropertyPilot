import clsx from "clsx";
import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const areaId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={areaId} className="label-field">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={areaId}
          className={clsx(
            "input-field min-h-[96px] resize-y",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

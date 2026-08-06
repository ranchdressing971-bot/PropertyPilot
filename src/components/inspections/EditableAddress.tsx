"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import clsx from "clsx";
import { Loader2, Pencil } from "lucide-react";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { inputClassName } from "@/components/ui/Input";
import { confirmInspectionAddress } from "@/lib/confirm-inspection-address";

interface EditableAddressProps {
  address: string;
  inspectionId: string;
  propertyId: string;
  onSaved: (address: string) => void;
}

export function EditableAddress({
  address,
  inspectionId,
  propertyId,
  onSaved,
}: EditableAddressProps) {
  const { isDemo } = useAppMode();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(address);
  }, [address]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setValue(address);
    setError(null);
    setEditing(false);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a full address with house number");
      return;
    }
    if (trimmed === address) {
      setEditing(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isDemo) {
        onSaved(trimmed);
        setEditing(false);
        return;
      }
      const result = await confirmInspectionAddress(
        inspectionId,
        propertyId,
        trimmed
      );
      onSaved(result.address);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save address");
    } finally {
      setLoading(false);
    }
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (loading) return;
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;

    const trimmed = value.trim();
    if (!trimmed || trimmed === address) {
      cancel();
      return;
    }
    void save();
  }

  if (editing) {
    return (
      <div ref={rootRef} className="space-y-1.5">
        <div className="relative">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            onBlur={handleBlur}
            disabled={loading}
            aria-label="Edit address"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `address-error-${propertyId}` : undefined}
            placeholder="e.g. 456 Oak Lane"
            className={clsx(
              inputClassName,
              "mt-0 h-9 px-3 text-sm font-semibold sm:text-base"
            )}
          />
          {loading && (
            <Loader2
              className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-400"
              aria-hidden
            />
          )}
        </div>
        {error && (
          <p
            id={`address-error-${propertyId}`}
            className="text-xs text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
        <p className="text-[11px] text-ink-500">Enter to save, Esc to cancel</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group -mx-1 flex w-[calc(100%+0.5rem)] items-start gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
      aria-label={`Edit address ${address}`}
    >
      <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink-900 sm:text-base">
        {address}
      </h3>
      <Pencil
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400 opacity-70 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}

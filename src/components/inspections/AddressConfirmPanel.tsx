"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check, Loader2, MapPin, Pencil, ShieldCheck } from "lucide-react";

interface AddressConfirmPanelProps {
  inspectionId: string;
  propertyId: string;
  address: string;
  confidence?: number;
  onConfirmed: (newAddress: string) => void;
}

export function AddressConfirmPanel({
  inspectionId,
  propertyId,
  address,
  confidence,
  onConfirmed,
}: AddressConfirmPanelProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedNote, setVerifiedNote] = useState<string | null>(null);

  async function submit(confirmedAddress: string) {
    const trimmed = confirmedAddress.trim();
    if (!trimmed) {
      setError("Enter a full address with house number");
      return;
    }
    setLoading(true);
    setError(null);
    setVerifiedNote(null);
    try {
      const res = await fetch(`/api/inspection/${inspectionId}/confirm-address`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, address: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save address");
      onConfirmed(data.address ?? trimmed);
      setVerifiedNote(
        data.source === "roster"
          ? "Matched your community roster"
          : "Verified as a real street address"
      );
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save address");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
        <MapPin className="h-3 w-3" />
        Confirm house number
        {typeof confidence === "number" ? (
          <span className="font-normal normal-case text-amber-700/80">
            · AI {confidence}%
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-amber-900/80">
        Check the mailbox in the photo. We&apos;ll verify it&apos;s a real address
        before saving.
      </p>

      {editing ? (
        <div className="mt-2 space-y-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 456 Oak Lane"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={loading}
              onClick={() => submit(value)}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              {loading ? "Checking map…" : "Verify & save"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setEditing(false);
                setValue(address);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => submit(address)}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {loading ? "Checking map…" : "Looks right"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Fix number
          </Button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
          {verifiedNote && (
            <p className="flex w-full items-center gap-1 text-xs text-brand-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {verifiedNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface RosterImportProps {
  neighborhood?: string;
  onImport: (csv: string) => Promise<{ count?: number } | void>;
  /** When true, show as recommended (not optional) */
  recommended?: boolean;
}

const SAMPLE_CSV = `address,lot
123 Main St,12
456 Oak Dr,14
789 Pine Ln,8`;

export function RosterImport({
  neighborhood,
  onImport,
  recommended = true,
}: RosterImportProps) {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rowPreview, setRowPreview] = useState<number | null>(null);

  function countDataRows(text: string): number {
    return text
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^address\b/i.test(l)).length;
  }

  async function handleImport() {
    if (!csv.trim()) {
      setError("Paste CSV content or upload a file");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await onImport(csv);
      const n = result?.count ?? countDataRows(csv);
      setSuccess(
        `Imported ${n} address${n === 1 ? "" : "es"}${
          neighborhood ? ` for ${neighborhood}` : ""
        }. AI will match mailbox numbers to this list on the next upload.`
      );
      setCsv("");
      setRowPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsv(text);
      setRowPreview(countDataRows(text));
      setSuccess(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 text-brand-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-ink-900">
            {recommended ? "Import community address list" : "Optional address list"}
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Upload a CSV of every home (house number + street). AI reads mailbox
            digits from video and matches them to this list — much more accurate
            than guessing the street alone.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-500">
            <li>
              • Columns: <code className="rounded bg-ink-100 px-1">address</code>{" "}
              required; <code className="rounded bg-ink-100 px-1">lot</code> optional
            </li>
            <li>• One home per row — e.g. <code className="rounded bg-ink-100 px-1">456 Oak Dr</code></li>
            <li>• Export from Excel / Google Sheets as CSV</li>
          </ul>
        </div>
      </div>

      <textarea
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setRowPreview(countDataRows(e.target.value));
          setSuccess(null);
        }}
        placeholder={SAMPLE_CSV}
        rows={6}
        className="mt-4 w-full rounded-xl border border-ink-200 px-4 py-3 font-mono text-sm focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
      />

      {rowPreview != null && rowPreview > 0 && !success && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {rowPreview} address{rowPreview === 1 ? "" : "es"} ready to import
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-brand-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <label>
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
            <Upload className="h-4 w-4" />
            Choose CSV
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        <Button onClick={handleImport} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import roster
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setCsv(SAMPLE_CSV);
            setRowPreview(3);
            setSuccess(null);
          }}
          type="button"
        >
          Load sample
        </Button>
      </div>
    </Card>
  );
}

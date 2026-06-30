"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, FileText, Loader2 } from "lucide-react";

interface RosterImportProps {
  neighborhood?: string;
  onImport: (csv: string) => Promise<void>;
}

const SAMPLE_CSV = `address,lot
123 Main St,12
456 Oak Dr,14
789 Pine Ln,8`;

export function RosterImport({ neighborhood, onImport }: RosterImportProps) {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!csv.trim()) {
      setError("Paste CSV content or upload a file");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onImport(csv);
      setCsv("");
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
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 text-ink-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-ink-900">Optional address list</h3>
          <p className="mt-1 text-sm text-ink-500">
            AI finds addresses from video automatically. Import a CSV only if you
            want to cross-check against a known list.
          </p>
        </div>
      </div>

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={SAMPLE_CSV}
        rows={6}
        className="mt-4 w-full rounded-xl border border-ink-200 px-4 py-3 font-mono text-sm focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <label>
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
            <Upload className="h-4 w-4" />
            Choose CSV
          </span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>
        <Button onClick={handleImport} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import roster
        </Button>
        <Button
          variant="secondary"
          onClick={() => setCsv(SAMPLE_CSV)}
          type="button"
        >
          Load sample
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, Loader2 } from "lucide-react";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

const NOTIFY_KEY = "pp-notify-violations";

export function NotificationsCard() {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(NOTIFY_KEY);
    if (stored !== null) setEnabled(stored === "true");
  }, []);

  async function handleSave() {
    setSaving(true);
    localStorage.setItem(NOTIFY_KEY, String(enabled));

    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          notify_violations: enabled,
        });
        await supabase.auth.updateUser({
          data: { notify_violations: enabled },
        });
      }
    }
    setSaving(false);
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-slate-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          <p className="text-sm text-slate-500">
            Email alerts when new violations are flagged
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Enabled
        </label>
      </div>
      <Button variant="secondary" size="sm" className="mt-4" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save preference
      </Button>
      <p className="mt-2 text-xs text-slate-400">
        Email delivery requires SMTP integration (coming soon).
      </p>
    </Card>
  );
}

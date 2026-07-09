"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_CCR_RULES,
  loadCcrRules,
  saveCcrRules,
  type CcrRule,
} from "@/lib/ccr-rules";
import { Shield, Loader2 } from "lucide-react";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

export function CcrRulesCard() {
  const [rules, setRules] = useState<CcrRule[]>(DEFAULT_CCR_RULES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRules(loadCcrRules());
  }, []);

  function toggleRule(index: number) {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r))
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    saveCcrRules(rules);

    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          ccr_rules: rules,
        });
        await supabase.auth.updateUser({ data: { ccr_rules: rules } });
      }
    }

    setSaving(false);
    setSaved(true);
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-ink-400" />
        <div>
          <h3 className="font-semibold text-ink-900">CC&R Rules</h3>
          <p className="text-sm text-ink-500">
            Toggle which violations AI should detect during inspections
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {rules.map((rule, i) => (
          <li
            key={rule.violationType}
            className="flex items-start gap-3 rounded-lg border border-ink-100 bg-ink-50/80 p-3"
          >
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => toggleRule(i)}
              className="mt-1 h-4 w-4 rounded border-ink-300"
            />
            <div className="flex-1 text-sm">
              <p className="font-medium text-ink-900">
                {rule.violationType}{" "}
                <span className="text-ink-400">§{rule.section}</span>
              </p>
              <p className="mt-0.5 text-ink-500">{rule.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save rules
        </Button>
        {saved && (
          <span className="text-xs text-emerald-600">Rules saved</span>
        )}
      </div>
    </Card>
  );
}

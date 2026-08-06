"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DEFAULT_CCR_RULES,
  createCustomRule,
  isBuiltinRule,
  loadCcrRules,
  saveCcrRules,
  type CcrRule,
} from "@/lib/ccr-rules";
import { Shield, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

export function CcrRulesCard() {
  const [rules, setRules] = useState<CcrRule[]>(DEFAULT_CCR_RULES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setRules(loadCcrRules());
  }, []);

  function markDirty() {
    setSaved(false);
  }

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    markDirty();
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormError(null);
  }

  function startAdd() {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(rule: CcrRule) {
    if (isBuiltinRule(rule)) return;
    setEditingId(rule.id);
    setFormName(rule.violationType);
    setFormDescription(rule.description);
    setFormError(null);
    setShowForm(true);
  }

  function nameTaken(name: string, exceptId?: string | null): boolean {
    const lower = name.trim().toLowerCase();
    return rules.some(
      (r) => r.id !== exceptId && r.violationType.toLowerCase() === lower
    );
  }

  function submitForm() {
    const name = formName.trim();
    const description = formDescription.trim();
    if (!name || !description) {
      setFormError("Name and description are required.");
      return;
    }
    if (nameTaken(name, editingId)) {
      setFormError("A rule with that name already exists.");
      return;
    }

    if (editingId) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                violationType: name,
                description,
                custom: true,
              }
            : r
        )
      );
    } else {
      const created = createCustomRule({ name, description });
      if (!created) {
        setFormError("Could not create rule.");
        return;
      }
      setRules((prev) => [...prev, created]);
    }

    markDirty();
    resetForm();
  }

  function deleteRule(id: string) {
    const target = rules.find((r) => r.id === id);
    if (!target || isBuiltinRule(target)) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) resetForm();
    markDirty();
  }

  async function handleSave() {
    setSaving(true);
    saveCcrRules(rules);

    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
            Built-in detections plus custom rules for street-side checks
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {rules.map((rule) => {
          const builtin = isBuiltinRule(rule);
          return (
            <li
              key={rule.id}
              className="flex items-start gap-3 rounded-lg border border-ink-100 bg-ink-50/80 p-3"
            >
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
                className="mt-1 h-4 w-4 rounded border-ink-300"
                aria-label={`Enable ${rule.violationType}`}
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-ink-900">
                  {rule.violationType}{" "}
                  <span className="text-ink-400">
                    {builtin ? `§${rule.section}` : "Custom"}
                  </span>
                </p>
                <p className="mt-0.5 text-ink-500">{rule.description}</p>
              </div>
              {!builtin && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(rule)}
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                    aria-label={`Edit ${rule.violationType}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-700"
                    aria-label={`Delete ${rule.violationType}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {showForm ? (
        <div className="mt-4 rounded-lg border border-ink-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900">
              {editingId ? "Edit custom rule" : "Add custom rule"}
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-3 block text-sm text-ink-700">
            Rule name
            <Input
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                setFormError(null);
              }}
              placeholder="e.g. Boat in driveway"
              maxLength={80}
            />
          </label>
          <label className="mt-3 block text-sm text-ink-700">
            What to look for from the street
            <textarea
              value={formDescription}
              onChange={(e) => {
                setFormDescription(e.target.value);
                setFormError(null);
              }}
              placeholder="Describe the curb-visible condition the AI should flag"
              maxLength={400}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 shadow-sm placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            />
          </label>
          {formError && (
            <p className="mt-2 text-xs text-red-600">{formError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" type="button" onClick={submitForm}>
              {editingId ? "Update rule" : "Add rule"}
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button size="sm" type="button" variant="secondary" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
        </div>
      )}

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

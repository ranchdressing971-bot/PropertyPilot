"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_COLLECTION_DAYS,
  WEEKDAYS,
  formatCollectionDays,
  loadCollectionDays,
  saveCollectionDays,
  weekdayFromDate,
  type Weekday,
} from "@/lib/trash-collection";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { Trash2, Loader2 } from "lucide-react";
import clsx from "clsx";

export function TrashCollectionCard() {
  const [days, setDays] = useState<Weekday[]>(DEFAULT_COLLECTION_DAYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = weekdayFromDate();

  useEffect(() => {
    setDays(loadCollectionDays());
  }, []);

  function toggle(day: Weekday) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    saveCollectionDays(days);

    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          trash_collection_days: days,
        });
        await supabase.auth.updateUser({
          data: { trash_collection_days: days },
        });
      }
    }

    setSaving(false);
    setSaved(true);
  }

  const isPickupToday = days.includes(today);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100">
          <Trash2 className="h-5 w-5 text-ink-600" />
        </div>
        <div>
          <h3 className="font-semibold text-ink-900">Trash collection days</h3>
          <p className="text-sm text-ink-500">
            Bin flags only on non-pickup days — bins are allowed out on these days
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {WEEKDAYS.map((d, i) => {
          const on = days.includes(d.id);
          const isToday = d.id === today;
          return (
            <motion.button
              key={d.id}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 16 }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.06 }}
              onClick={() => toggle(d.id)}
              className={clsx(
                "relative rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                on
                  ? "bg-ink-900 text-white shadow-sm"
                  : "bg-ink-50 text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100",
                isToday && "ring-2 ring-brand-400 ring-offset-2"
              )}
            >
              {d.short}
              {isToday && (
                <span
                  className={clsx(
                    "absolute -right-1 -top-1 h-2 w-2 rounded-full",
                    on ? "bg-brand-300" : "bg-brand-500"
                  )}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        Schedule: <span className="font-medium text-ink-700">{formatCollectionDays(days)}</span>
        {" · "}
        Today{" "}
        {isPickupToday ? (
          <span className="font-medium text-brand-700">is a pickup day</span>
        ) : (
          <span className="font-medium text-amber-700">is not pickup</span>
        )}
        {" — "}
        {isPickupToday
          ? "visible bins will not be flagged."
          : "visible bins can be flagged."}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save schedule
        </Button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-emerald-600"
          >
            Saved
          </motion.span>
        )}
      </div>
    </Card>
  );
}

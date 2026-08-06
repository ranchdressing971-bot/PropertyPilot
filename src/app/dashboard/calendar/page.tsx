"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatTime, titleCaseStatus } from "@/lib/format";
import { JOB_STATUSES } from "@/lib/types";

export default function CalendarPage() {
  const { jobs, customers, updateJob } = useTradeFlow();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [status, setStatus] = useState("all");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const visibleJobs = useMemo(
    () => jobs.filter((j) => status === "all" || j.status === status),
    [jobs, status]
  );

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor, view]);

  function jobsOn(day: Date) {
    return visibleJobs.filter(
      (j) => j.scheduled_date && isSameDay(parseISO(`${j.scheduled_date}T12:00:00`), day)
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="mt-1 text-sm text-ink-500">Jobs by scheduled date</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === "month" ? "primary" : "secondary"}
            onClick={() => setView("month")}
          >
            Month
          </Button>
          <Button
            variant={view === "week" ? "primary" : "secondary"}
            onClick={() => setView("week")}
          >
            Week
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setCursor(view === "month" ? addMonths(cursor, -1) : addDays(cursor, -7))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[140px] text-center font-display text-lg font-semibold">
            {format(cursor, view === "month" ? "MMMM yyyy" : "'Week of' MMM d")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setCursor(view === "month" ? addMonths(cursor, 1) : addDays(cursor, 7))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select
          className="w-44"
          options={[
            { value: "all", label: "All statuses" },
            ...JOB_STATUSES.map((s) => ({ value: s, label: titleCaseStatus(s) })),
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      <Card padding="sm" className="overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-ink-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-ink-50 px-2 py-2 text-center text-xs font-semibold text-ink-500">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dayJobs = jobsOn(day);
            const inMonth = isSameMonth(day, cursor);
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[96px] bg-white p-1.5 sm:min-h-[120px] sm:p-2 ${
                  inMonth || view === "week" ? "" : "bg-ink-50/70 text-ink-400"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isSameDay(day, new Date())
                        ? "rounded-full bg-brand-600 px-1.5 py-0.5 text-white"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <Link
                    href={`/dashboard/jobs/new?date=${dateStr}`}
                    className="text-[10px] font-semibold text-brand-700 opacity-80 hover:opacity-100"
                  >
                    +
                  </Link>
                </div>
                <div className="space-y-1">
                  {dayJobs.slice(0, view === "week" ? 8 : 3).map((job) => (
                    <div key={job.id} className="group relative">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="block truncate rounded-lg bg-brand-50 px-1.5 py-1 text-[10px] font-semibold text-brand-800 sm:text-xs"
                      >
                        {formatTime(job.start_time)} {customerMap.get(job.customer_id)?.full_name}
                      </Link>
                      <button
                        type="button"
                        className="mt-0.5 hidden text-[10px] font-medium text-ink-500 group-hover:inline"
                        onClick={() => {
                          setRescheduleId(job.id);
                          setRescheduleDate(job.scheduled_date ?? dateStr);
                        }}
                      >
                        Reschedule
                      </button>
                    </div>
                  ))}
                  {dayJobs.length > (view === "week" ? 8 : 3) ? (
                    <p className="text-[10px] text-ink-400">+{dayJobs.length - 3} more</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {rescheduleId ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card-hover">
            <h3 className="font-display text-lg font-semibold">Reschedule job</h3>
            <div className="mt-4">
              <Input
                label="New date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRescheduleId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateJob(rescheduleId, { scheduled_date: rescheduleDate });
                  toast("Job rescheduled.");
                  setRescheduleId(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-semibold">Agenda</h2>
        <ul className="mt-3 space-y-2">
          {visibleJobs
            .filter((j) => j.scheduled_date)
            .sort((a, b) => `${a.scheduled_date}${a.start_time}`.localeCompare(`${b.scheduled_date}${b.start_time}`))
            .slice(0, 10)
            .map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 hover:border-brand-200"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {customerMap.get(job.customer_id)?.full_name} · {job.service_type}
                    </p>
                    <p className="text-xs text-ink-500">
                      {job.scheduled_date} · {formatTime(job.start_time)}
                    </p>
                  </div>
                  <Badge status={job.status} />
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

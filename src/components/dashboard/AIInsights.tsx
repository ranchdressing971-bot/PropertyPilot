"use client";

import { motion } from "framer-motion";
import { aiInsights } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Sparkles, Clock, TrendingUp, Repeat } from "lucide-react";

export function AIInsights() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent-50 opacity-60" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Today&apos;s Insights
          </h3>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:grid sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-slate-50 p-4"
          >
            <p className="text-xs font-medium text-slate-500">Most Common Violation</p>
            <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">
              {aiInsights.mostCommonViolation}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-slate-50 p-4"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Avg Inspection Time</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {aiInsights.avgInspectionTime}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl bg-slate-50 p-4"
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Compliance Score</p>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <p className="text-sm font-semibold text-slate-900">
                {aiInsights.complianceScore}%
              </p>
              <span className="text-xs text-emerald-600">+3%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${aiInsights.complianceScore}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full bg-accent-500"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl bg-slate-50 p-4"
          >
            <div className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Repeat Offenders</p>
            </div>
            <ul className="mt-3 space-y-2">
              {aiInsights.repeatOffenders.slice(0, 2).map((offender) => (
                <li
                  key={offender.address}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span className="text-slate-700">{offender.address}</span>
                  <span className="shrink-0 font-medium text-red-600">
                    {offender.count}x
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </Card>
  );
}

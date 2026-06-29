"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  Plane,
  Upload,
  Play,
  Shield,
  Zap,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen mesh-bg bg-white">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 shadow-lg shadow-accent-500/30">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              Property Pilot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="hidden xs:block">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-accent-400/20 blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
            className="absolute -right-10 top-40 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl"
          />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-accent-700 shadow-sm sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              GPT-4o Vision · Real AI Inspections
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Property{" "}
              <span className="gradient-text">Pilot</span>
            </h1>

            <p className="mt-4 text-xl font-medium tracking-tight text-slate-400 sm:text-3xl">
              Drive Once.
              <br />
              <span className="text-slate-900">Inspect Every Property.</span>
            </p>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Upload a neighborhood drive-through video. AI analyzes every home
              and prepares violation reports for your review.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <Link href="/dashboard/inspections/upload" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  <Upload className="h-5 w-5" />
                  Upload Video
                </Button>
              </Link>
              <Link href="/dashboard/inspections/insp-1" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  <Play className="h-5 w-5" />
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-t border-slate-200/50 bg-slate-50/80 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                icon: Upload,
                title: "Upload & Record",
                desc: "Drag-and-drop from your phone or desktop. Works on any device.",
              },
              {
                icon: Shield,
                title: "AI Compliance Checks",
                desc: "GPT-4o Vision detects trash bins, tall grass, debris, and dead landscaping.",
              },
              {
                icon: BarChart3,
                title: "Manager Dashboard",
                desc: "Review violations, approve notices, and track compliance scores.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 sm:p-8"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 shadow-lg shadow-accent-500/25">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-accent-600 to-accent-500 px-6 py-12 text-center text-white shadow-2xl shadow-accent-600/30 sm:px-12 sm:py-16">
          <Zap className="mx-auto h-8 w-8 opacity-90" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to streamline inspections?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-accent-100 sm:text-base">
            HOA managers save hours every week with AI-powered property reviews.
          </p>
          <Link href="/dashboard" className="mt-8 inline-block">
            <Button
              size="lg"
              className="bg-white text-accent-700 shadow-xl hover:bg-accent-50"
            >
              Open Dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200/50 py-6 sm:py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Plane className="h-4 w-4" />
            Property Pilot
          </div>
          <p className="text-xs text-slate-400 sm:text-sm">
            &copy; 2026 Property Pilot
          </p>
        </div>
      </footer>
    </div>
  );
}

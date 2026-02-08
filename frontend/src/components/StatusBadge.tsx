"use client";

import { STATUS_LABELS } from "@/lib/constants";

const BADGE_STYLES: Record<number, string> = {
  0: "bg-white/5 text-gray-400 border-white/10",
  1: "bg-white/10 text-gray-300 border-white/15",
  2: "bg-white/8 text-gray-400 border-white/12",
  3: "bg-white/5 text-gray-500 border-white/10",
  4: "bg-white/5 text-gray-500 border-white/10",
  5: "bg-white/5 text-gray-600 border-white/8",
};

export function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase border ${BADGE_STYLES[status] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
    >
      {STATUS_LABELS[status] ?? `Unknown (${status})`}
    </span>
  );
}

"use client";

import { STATUS_LABELS } from "@/lib/constants";

const BADGE_STYLES: Record<number, string> = {
  0: "bg-amber-500/10 text-amber-400/90 border-amber-500/20",
  1: "bg-emerald-500/10 text-emerald-400/90 border-emerald-500/20",
  2: "bg-blue-500/10 text-blue-400/90 border-blue-500/20",
  3: "bg-red-500/10 text-red-400/90 border-red-500/20",
  4: "bg-orange-500/10 text-orange-400/90 border-orange-500/20",
  5: "bg-gray-500/10 text-gray-400/90 border-gray-500/20",
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

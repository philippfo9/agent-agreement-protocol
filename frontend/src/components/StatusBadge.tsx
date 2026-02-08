"use client";

import { STATUS_LABELS, STATUS_COLORS, STATUS_BG_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BG_COLORS[status] || ""} ${STATUS_COLORS[status] || ""}`}
    >
      {STATUS_LABELS[status] || `Unknown (${status})`}
    </span>
  );
}

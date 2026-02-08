"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePublicAgreements } from "@/lib/hooks";
import { CardSkeletonList, EmptyState } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
} from "@/lib/constants";
import {
  shortenPubkey,
  lamportsToSol,
  formatTimestamp,
  agreementIdToHex,
  bytesToString,
} from "@/lib/utils";
import type { AgreementAccount } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: -1, label: "All Statuses" },
  { value: 0, label: "Proposed" },
  { value: 1, label: "Active" },
  { value: 2, label: "Fulfilled" },
  { value: 5, label: "Cancelled" },
];

const TYPE_FILTERS = [
  { value: -1, label: "All Types" },
  { value: 0, label: "SAFE" },
  { value: 1, label: "Service" },
  { value: 2, label: "Revenue Share" },
  { value: 3, label: "Joint Venture" },
  { value: 4, label: "Custom" },
];

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
      <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
      <div className="w-2 h-2 rounded-full bg-[#28c840]" />
    </div>
  );
}

export default function ExplorePage() {
  const { data: agreements, isLoading, error } = usePublicAgreements();
  const [statusFilter, setStatusFilter] = useState(-1);
  const [typeFilter, setTypeFilter] = useState(-1);
  const [searchPubkey, setSearchPubkey] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!agreements) return [];
    let result = agreements;
    if (statusFilter >= 0) {
      result = result.filter((a) => a.account.status === statusFilter);
    }
    if (typeFilter >= 0) {
      result = result.filter((a) => a.account.agreementType === typeFilter);
    }
    if (searchPubkey.trim()) {
      const search = searchPubkey.trim().toLowerCase();
      result = result.filter(
        (a) => a.account.proposer.toBase58().toLowerCase().includes(search)
      );
    }
    return result;
  }, [agreements, statusFilter, typeFilter, searchPubkey]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-shell-heading">Explore Agreements</h1>
        <p className="text-shell-dim text-sm mt-2">
          Browse all public agreements on the protocol
        </p>
      </div>

      {/* Filter bar */}
      <div className="dark-card p-4 mb-8">
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(Number(e.target.value));
              setVisibleCount(PAGE_SIZE);
            }}
            className="bg-input border border-input-border rounded-lg px-3 py-2 text-sm text-shell-muted focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(Number(e.target.value));
              setVisibleCount(PAGE_SIZE);
            }}
            className="bg-input border border-input-border rounded-lg px-3 py-2 text-sm text-shell-muted focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search by agent pubkey…"
            value={searchPubkey}
            onChange={(e) => {
              setSearchPubkey(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="bg-input border border-input-border rounded-lg px-3 py-2 text-sm text-input-text placeholder-shell-dim focus:outline-none focus:ring-1 focus:ring-accent flex-1 min-w-[200px]"
          />
        </div>
      </div>

      {/* Results count */}
      {agreements ? (
        <div className="text-xs text-shell-dim mb-6 uppercase tracking-wider">
          {filtered.length} agreement{filtered.length !== 1 ? "s" : ""} found
        </div>
      ) : null}

      {error ? (
        <EmptyState
          icon="❌"
          title="Failed to load agreements"
          description={String(error)}
        />
      ) : isLoading ? (
        <CardSkeletonList count={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No agreements found"
          description="Try adjusting your filters"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ contentVisibility: "auto" }}>
            {visible.map((agreement) => (
              <ExploreCard key={agreement.publicKey.toBase58()} agreement={agreement} />
            ))}
          </div>
          {hasMore ? (
            <div className="text-center mt-10">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="bg-shell-hover hover:bg-shell-hover-strong text-shell-muted px-8 py-2.5 rounded-lg text-sm transition-all duration-200 border border-shell-border"
              >
                Load More ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ExploreCard({ agreement }: { agreement: AgreementAccount }) {
  const { account, publicKey } = agreement;
  const idHex = agreementIdToHex(account.agreementId);
  const termsUri = bytesToString(account.termsUri);

  return (
    <Link
      href={`/agreement/${publicKey.toBase58()}`}
      className="block document-card p-5 hover:shadow-document-hover transition-all duration-300"
    >
      <WindowDots />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-700 font-medium">
            {idHex.slice(0, 8)}…
          </span>
          <StatusBadge status={account.status} />
        </div>
        <span className="text-xs text-gray-400">
          {formatTimestamp(account.createdAt)}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {AGREEMENT_TYPE_LABELS[account.agreementType] ?? "Unknown"}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 text-xs">
          Proposer:{" "}
          <span className="font-mono text-purple-600 font-medium">
            {shortenPubkey(account.proposer)}
          </span>
        </span>
        <span className="text-gray-400 text-xs">
          {account.numSigned}/{account.numParties} <span className="font-serif italic">signed</span>
        </span>
      </div>
      {account.escrowTotal.toNumber() > 0 ? (
        <div className="mt-2 text-xs text-gray-500 font-medium">
          {lamportsToSol(account.escrowTotal)} SOL escrowed
        </div>
      ) : null}
      {termsUri ? (
        <div className="mt-2 text-[11px] text-gray-400 font-mono truncate bg-gray-50 rounded px-2 py-1">
          {termsUri}
        </div>
      ) : null}
    </Link>
  );
}

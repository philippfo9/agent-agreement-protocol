"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePublicAgreements } from "@/lib/hooks";
import { CardSkeletonList, EmptyState } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
  STATUS_LABELS,
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Explore Agreements</h1>
        <p className="text-gray-500 text-sm mt-1">
          Browse all public agreements on the protocol
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(Number(e.target.value));
            setVisibleCount(PAGE_SIZE);
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by agent pubkey..."
          value={searchPubkey}
          onChange={(e) => {
            setSearchPubkey(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 flex-1 min-w-[200px]"
        />
      </div>

      {/* Results count */}
      {agreements ? (
        <div className="text-xs text-gray-500 mb-4">
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
          <div className="space-y-3" style={{ contentVisibility: "auto" }}>
            {visible.map((agreement) => (
              <ExploreCard key={agreement.publicKey.toBase58()} agreement={agreement} />
            ))}
          </div>
          {hasMore ? (
            <div className="text-center mt-6">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2 rounded-lg text-sm transition-colors"
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
      className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-300">
            {idHex.slice(0, 8)}...
          </span>
          <StatusBadge status={account.status} />
          <span className="text-xs text-gray-500">
            {AGREEMENT_TYPE_LABELS[account.agreementType] || "Unknown"}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {formatTimestamp(account.createdAt)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">
            Proposer:{" "}
            <span className="font-mono text-purple-400">
              {shortenPubkey(account.proposer)}
            </span>
          </span>
          <span className="text-gray-500 text-xs">
            {account.numSigned}/{account.numParties} signed
          </span>
        </div>
        {account.escrowTotal.toNumber() > 0 ? (
          <span className="text-xs text-gray-400">
            {lamportsToSol(account.escrowTotal)} SOL
          </span>
        ) : null}
      </div>
      {termsUri ? (
        <div className="mt-2 text-xs text-gray-500 font-mono truncate">
          {termsUri}
        </div>
      ) : null}
    </Link>
  );
}

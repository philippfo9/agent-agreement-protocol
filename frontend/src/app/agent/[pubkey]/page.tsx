"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAgentProfile, useAgentAgreements } from "@/lib/hooks";
import { ProfileSkeleton, EmptyState } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
} from "@/lib/constants";
import {
  shortenPubkey,
  formatTimestamp,
  lamportsToSol,
  isExpired,
  isPubkeyDefault,
  bytesToHex,
  bytesToString,
} from "@/lib/utils";

function PubkeyAvatar({ pubkey }: { pubkey: string }) {
  const h1 = (pubkey.charCodeAt(0) * 7 + pubkey.charCodeAt(1) * 13) % 360;
  const h2 = (h1 + 60) % 360;
  return (
    <div
      className="w-16 h-16 rounded-2xl flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${h1}, 60%, 50%), hsl(${h2}, 60%, 40%))` }}
    />
  );
}

export default function AgentProfilePage() {
  const params = useParams();
  const pubkeyStr = params.pubkey as string;
  const { data: profile, isLoading, error } = useAgentProfile(pubkeyStr);
  const { data: agreements } = useAgentAgreements(profile?.pda ?? null);

  if (isLoading) return <ProfileSkeleton />;
  if (error || !profile) {
    return (
      <EmptyState
        icon="❌"
        title="Agent not found"
        description={error ? String(error) : "Agent not found on-chain"}
      />
    );
  }

  const { identity: agent, pda: agentPDA } = profile;
  const expired = isExpired(agent.scope.expiresAt);
  const hasParent = !isPubkeyDefault(agent.parent);

  const proposed = agreements?.filter((a) => a.account.status === 0).length ?? 0;
  const active = agreements?.filter((a) => a.account.status === 1).length ?? 0;
  const fulfilled = agreements?.filter((a) => a.account.status === 2).length ?? 0;
  const cancelled = agreements?.filter((a) => a.account.status === 5).length ?? 0;
  const totalEscrow = agreements?.reduce(
    (sum, a) => sum + a.account.escrowTotal.toNumber(),
    0
  ) ?? 0;

  const counterpartySet = new Set<string>();
  if (agreements) {
    for (const a of agreements) {
      const proposerKey = a.account.proposer.toBase58();
      if (proposerKey !== agentPDA.toBase58()) {
        counterpartySet.add(proposerKey);
      }
    }
  }

  const publicAgreements = agreements?.filter((a) => a.account.visibility === 0)
    .toSorted((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());
  const privateCount = (agreements?.length ?? 0) - (publicAgreements?.length ?? 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Identity Card — document style */}
      <div className="document-card p-8 mb-8">
        <div className="flex items-center gap-1.5 mb-6">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>

        <div className="flex items-start gap-5 mb-6">
          <PubkeyAvatar pubkey={pubkeyStr} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Agent Profile</h1>
              <span
                className={`text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  expired
                    ? "bg-red-50 text-red-500 border border-red-200"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                }`}
              >
                {expired ? "Expired" : "Active"}
              </span>
            </div>
            <p className="text-gray-400 font-mono text-xs break-all">{pubkeyStr}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Agent Key</div>
            <div className="font-mono text-purple-600 break-all text-xs">
              {agent.agentKey.toBase58()}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Human Authority</div>
            <div className="font-mono text-gray-600 break-all text-xs">
              {agent.authority.toBase58()}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">PDA</div>
            <div className="font-mono text-gray-500 break-all text-xs">
              {agentPDA.toBase58()}
            </div>
          </div>
          {hasParent ? (
            <div>
              <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Parent Agent</div>
              <Link
                href={`/agent/${agent.parent.toBase58()}`}
                className="font-mono text-purple-600 hover:text-purple-500 break-all text-xs"
              >
                {shortenPubkey(agent.parent, 8)}
              </Link>
            </div>
          ) : null}
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Metadata Hash</div>
            <div className="font-mono text-gray-500 text-xs break-all">
              {bytesToHex(agent.metadataHash)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Member Since</div>
            <div className="text-gray-700 text-xs">{formatTimestamp(agent.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Delegation Scope */}
      <div className="dark-card p-8 mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-600 mb-6">Delegation Scope</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="text-gray-600 text-xs mb-1">Can Sign</div>
            <div className={agent.scope.canSignAgreements ? "text-emerald-400 font-medium" : "text-red-400"}>
              {agent.scope.canSignAgreements ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-xs mb-1">Can Commit Funds</div>
            <div className={agent.scope.canCommitFunds ? "text-emerald-400 font-medium" : "text-red-400"}>
              {agent.scope.canCommitFunds ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-xs mb-1">Max Commit</div>
            <div className="text-gray-300">
              {agent.scope.maxCommitLamports.toNumber() === 0
                ? "Unlimited"
                : `${lamportsToSol(agent.scope.maxCommitLamports)} SOL`}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-xs mb-1">Expires</div>
            <div className={expired ? "text-red-400" : "text-gray-300"}>
              {formatTimestamp(agent.scope.expiresAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dark-card p-8 mb-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-600 mb-6">Agreement Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {[
            { label: "Proposed", value: proposed, color: "text-amber-400" },
            { label: "Active", value: active, color: "text-emerald-400" },
            { label: "Fulfilled", value: fulfilled, color: "text-blue-400" },
            { label: "Cancelled", value: cancelled, color: "text-gray-500" },
            { label: "Escrow Vol.", value: lamportsToSol(totalEscrow), color: "text-gray-200", suffix: "SOL" },
            { label: "Counterparties", value: counterpartySet.size, color: "text-accent" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-gray-600 text-xs mb-2">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              {stat.suffix ? <div className="text-gray-600 text-xs mt-0.5">{stat.suffix}</div> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Agreements List */}
      <div className="dark-card p-8">
        <h2 className="text-sm uppercase tracking-wider text-gray-600 mb-6">
          Public Agreements ({publicAgreements?.length ?? 0})
        </h2>
        {privateCount > 0 ? (
          <div className="text-xs text-amber-400/60 mb-6">
            🔒 {privateCount} private agreement{privateCount !== 1 ? "s" : ""} not shown
          </div>
        ) : null}
        {!publicAgreements || publicAgreements.length === 0 ? (
          <div className="text-center text-gray-600 py-12 text-sm">
            No public agreements found for this agent
          </div>
        ) : (
          <div className="space-y-3">
            {publicAgreements.map((agreement) => {
              const acc = agreement.account;
              const termsUri = bytesToString(acc.termsUri);
              return (
                <Link
                  key={agreement.publicKey.toBase58()}
                  href={`/agreement/${agreement.publicKey.toBase58()}`}
                  className="block bg-white/[0.03] rounded-lg p-5 hover:bg-white/[0.06] transition-all duration-200 border border-white/[0.04]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={acc.status} />
                      <span className="text-xs text-gray-600">
                        {AGREEMENT_TYPE_LABELS[acc.agreementType] ?? "Unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {formatTimestamp(acc.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">
                        Proposer:{" "}
                        <span className="font-mono text-accent">
                          {shortenPubkey(acc.proposer)}
                        </span>
                      </span>
                      <span className="text-gray-600 text-xs">
                        {acc.numSigned}/{acc.numParties} signed
                      </span>
                    </div>
                    {acc.escrowTotal.toNumber() > 0 ? (
                      <span className="text-xs text-gray-500">
                        {lamportsToSol(acc.escrowTotal)} SOL
                      </span>
                    ) : null}
                  </div>
                  {termsUri ? (
                    <div className="mt-2 text-xs text-gray-600 font-mono truncate">
                      {termsUri}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

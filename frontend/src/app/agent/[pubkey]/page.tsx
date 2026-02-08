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

  // Derived stats — computed during render
  const proposed = agreements?.filter((a) => a.account.status === 0).length ?? 0;
  const active = agreements?.filter((a) => a.account.status === 1).length ?? 0;
  const fulfilled = agreements?.filter((a) => a.account.status === 2).length ?? 0;
  const cancelled = agreements?.filter((a) => a.account.status === 5).length ?? 0;
  const totalEscrow = agreements?.reduce(
    (sum, a) => sum + a.account.escrowTotal.toNumber(),
    0
  ) ?? 0;

  // Unique counterparties: count unique proposer keys that aren't this agent's PDA
  const counterpartySet = new Set<string>();
  if (agreements) {
    for (const a of agreements) {
      const proposerKey = a.account.proposer.toBase58();
      if (proposerKey !== agentPDA.toBase58()) {
        counterpartySet.add(proposerKey);
      }
    }
  }

  const sortedAgreements = agreements?.toSorted(
    (a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Agent Profile</h1>
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${
              expired
                ? "bg-red-500/10 text-red-400"
                : "bg-green-500/10 text-green-400"
            }`}
          >
            {expired ? "Expired" : "Active"}
          </span>
        </div>
        <p className="text-gray-500 font-mono text-sm">{pubkeyStr}</p>
      </div>

      {/* Identity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-1">Agent Key</div>
            <div className="font-mono text-purple-400 break-all">
              {agent.agentKey.toBase58()}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Human Authority</div>
            <div className="font-mono text-gray-300 break-all">
              {agent.authority.toBase58()}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">PDA</div>
            <div className="font-mono text-gray-400 break-all">
              {agentPDA.toBase58()}
            </div>
          </div>
          {hasParent ? (
            <div>
              <div className="text-gray-500 text-xs mb-1">Parent Agent</div>
              <Link
                href={`/agent/${agent.parent.toBase58()}`}
                className="font-mono text-purple-400 hover:text-purple-300 break-all"
              >
                {shortenPubkey(agent.parent, 8)}
              </Link>
            </div>
          ) : null}
          <div>
            <div className="text-gray-500 text-xs mb-1">Metadata Hash</div>
            <div className="font-mono text-gray-400 text-xs break-all">
              {bytesToHex(agent.metadataHash)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Member Since</div>
            <div>{formatTimestamp(agent.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Delegation Scope */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Delegation Scope</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-1">Can Sign</div>
            <div className={agent.scope.canSignAgreements ? "text-green-400" : "text-red-400"}>
              {agent.scope.canSignAgreements ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Can Commit Funds</div>
            <div className={agent.scope.canCommitFunds ? "text-green-400" : "text-red-400"}>
              {agent.scope.canCommitFunds ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Max Commit</div>
            <div>
              {agent.scope.maxCommitLamports.toNumber() === 0
                ? "Unlimited"
                : `${lamportsToSol(agent.scope.maxCommitLamports)} SOL`}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Expires</div>
            <div className={expired ? "text-red-400" : ""}>
              {formatTimestamp(agent.scope.expiresAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Agreement Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Agreement Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-1">Proposed</div>
            <div className="text-2xl font-bold text-yellow-400">{proposed}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Active</div>
            <div className="text-2xl font-bold text-green-400">{active}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Fulfilled</div>
            <div className="text-2xl font-bold text-blue-400">{fulfilled}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Cancelled</div>
            <div className="text-2xl font-bold text-gray-400">{cancelled}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Escrow Volume</div>
            <div className="text-2xl font-bold">{lamportsToSol(totalEscrow)}</div>
            <div className="text-gray-500 text-xs">SOL</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Counterparties</div>
            <div className="text-2xl font-bold text-purple-400">{counterpartySet.size}</div>
          </div>
        </div>
      </div>

      {/* Agreements List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">
          Agreements ({agreements?.length ?? 0})
        </h2>
        {!sortedAgreements || sortedAgreements.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            No agreements found for this agent
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAgreements.map((agreement) => {
              const acc = agreement.account;
              const isPrivate = acc.visibility === 1;
              const termsUri = bytesToString(acc.termsUri);
              return (
                <Link
                  key={agreement.publicKey.toBase58()}
                  href={`/agreement/${agreement.publicKey.toBase58()}`}
                  className="block bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={acc.status} />
                      <span className="text-xs text-gray-500">
                        {AGREEMENT_TYPE_LABELS[acc.agreementType] || "Unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(acc.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">
                        Proposer:{" "}
                        <span className="font-mono text-purple-400">
                          {shortenPubkey(acc.proposer)}
                        </span>
                      </span>
                      <span className="text-gray-500 text-xs">
                        {acc.numSigned}/{acc.numParties} signed
                      </span>
                    </div>
                    <div className="text-right">
                      {acc.escrowTotal.toNumber() > 0 ? (
                        <span className="text-xs text-gray-400">
                          {lamportsToSol(acc.escrowTotal)} SOL
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {isPrivate ? (
                    <div className="mt-2 text-xs text-yellow-400/60">🔒 Encrypted terms</div>
                  ) : termsUri ? (
                    <div className="mt-2 text-xs text-gray-500 font-mono truncate">
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

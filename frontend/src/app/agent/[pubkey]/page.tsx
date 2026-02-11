"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAgentProfile, useAgentAgreements } from "@/lib/hooks";
import { VaultPanel } from "@/components/VaultPanel";
import { PolicyPanel } from "@/components/PolicyPanel";
import { DraftAgreementsPanel } from "@/components/DraftAgreementsPanel";
import { ProfileSkeleton, EmptyState } from "@/components/Loading";
import { trpc } from "@/lib/trpc";
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

function AgentDraftsSection({ agentPubkey }: { agentPubkey: string }) {
  const { data: policy } = trpc.getPolicy.useQuery({ agentPubkey });
  if (!policy?.requireHumanCosign) return null;
  return (
    <div className="mb-8">
      <DraftAgreementsPanel />
    </div>
  );
}

function PubkeyAvatar({ pubkey }: { pubkey: string }) {
  const h1 = 20 + ((pubkey.charCodeAt(0) * 7 + pubkey.charCodeAt(1) * 13) % 30);
  const h2 = h1 + 15;
  return (
    <div
      className="w-16 h-16 rounded-2xl flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(0, 0%, ${h1}%), hsl(0, 0%, ${h2}%))` }}
    />
  );
}

export default function AgentProfilePage() {
  const params = useParams();
  const wallet = useWallet();
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
          <div className="w-3 h-3 rounded-full bg-[#555]" />
          <div className="w-3 h-3 rounded-full bg-[#444]" />
          <div className="w-3 h-3 rounded-full bg-[#333]" />
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 mb-6">
          <PubkeyAvatar pubkey={pubkeyStr} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Agent Profile</h1>
              <span
                className={`text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  expired
                    ? "bg-gray-100 text-gray-500 border border-gray-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
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
            <div className="font-mono text-gray-600 break-all text-xs">
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
                className="font-mono text-gray-600 hover:text-gray-500 break-all text-xs"
              >
                {shortenPubkey(agent.parent, 8)}
              </Link>
            </div>
          ) : null}
          <div>
            <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">
              {bytesToString(agent.metadataHash) ? "Agent Name" : "Metadata Hash"}
            </div>
            <div className="font-mono text-gray-500 text-xs break-all">
              {bytesToString(agent.metadataHash) || bytesToHex(agent.metadataHash)}
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
        <h2 className="text-sm uppercase tracking-wider text-shell-dim mb-6">Delegation Scope</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="text-shell-dim text-xs mb-1">Can Sign</div>
            <div className={agent.scope.canSignAgreements ? "text-white font-medium" : "text-gray-500"}>
              {agent.scope.canSignAgreements ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Can Commit Funds</div>
            <div className={agent.scope.canCommitFunds ? "text-white font-medium" : "text-gray-500"}>
              {agent.scope.canCommitFunds ? "✓ Yes" : "✗ No"}
            </div>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Max Commit</div>
            <div className="text-shell-fg">
              {agent.scope.maxCommitLamports.toNumber() === 0
                ? "Unlimited"
                : `${lamportsToSol(agent.scope.maxCommitLamports)} SOL`}
            </div>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Expires</div>
            <div className={expired ? "text-gray-500" : "text-shell-fg"}>
              {formatTimestamp(agent.scope.expiresAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dark-card p-8 mb-8">
        <h2 className="text-sm uppercase tracking-wider text-shell-dim mb-6">Agreement Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {[
            { label: "Proposed", value: proposed, color: "text-gray-400" },
            { label: "Active", value: active, color: "text-gray-300" },
            { label: "Fulfilled", value: fulfilled, color: "text-gray-400" },
            { label: "Cancelled", value: cancelled, color: "text-shell-muted" },
            { label: "Escrow Vol.", value: lamportsToSol(totalEscrow), color: "text-shell-fg", suffix: "SOL" },
            { label: "Counterparties", value: counterpartySet.size, color: "text-white" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-shell-dim text-xs mb-2">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              {stat.suffix ? <div className="text-shell-dim text-xs mt-0.5">{stat.suffix}</div> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Vault — only for authority */}
      {wallet?.publicKey?.toBase58() === agent.authority.toBase58() && (
        <div className="mb-8">
          <VaultPanel agentIdentityPda={agentPDA} />
        </div>
      )}

      {/* Policy — only for authority */}
      {wallet?.publicKey?.toBase58() === agent.authority.toBase58() && (
        <>
          <div className="mb-8">
            <PolicyPanel agentPubkey={pubkeyStr} />
          </div>
          <AgentDraftsSection agentPubkey={pubkeyStr} />
        </>
      )}

      {/* Agreements List */}
      <div className="dark-card p-8">
        <h2 className="text-sm uppercase tracking-wider text-shell-dim mb-6">
          Public Agreements ({publicAgreements?.length ?? 0})
        </h2>
        {privateCount > 0 ? (
          <div className="text-xs text-gray-500 mb-6">
            🔒 {privateCount} private agreement{privateCount !== 1 ? "s" : ""} not shown
          </div>
        ) : null}
        {!publicAgreements || publicAgreements.length === 0 ? (
          <div className="text-center text-shell-dim py-12 text-sm">
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
                  className="block bg-shell-hover rounded-lg p-5 hover:bg-shell-hover-strong transition-all duration-200 border border-divider"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={acc.status} />
                      <span className="text-xs text-shell-dim">
                        {AGREEMENT_TYPE_LABELS[acc.agreementType] ?? "Unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-shell-dim">
                      {formatTimestamp(acc.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-shell-muted text-xs">
                        Proposer:{" "}
                        <span className="font-mono text-white">
                          {shortenPubkey(acc.proposer)}
                        </span>
                      </span>
                      <span className="text-shell-dim text-xs">
                        {acc.numSigned}/{acc.numParties} signed
                      </span>
                    </div>
                    {acc.escrowTotal.toNumber() > 0 ? (
                      <span className="text-xs text-shell-muted">
                        {lamportsToSol(acc.escrowTotal)} SOL
                      </span>
                    ) : null}
                  </div>
                  {termsUri ? (
                    <div className="mt-2 text-xs text-shell-dim font-mono truncate">
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

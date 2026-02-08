"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAgreementDetail } from "@/lib/hooks";
import { ProfileSkeleton, EmptyState } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";
import {
  shortenPubkey,
  lamportsToSol,
  formatTimestamp,
  agreementIdToHex,
  bytesToHex,
  bytesToString,
} from "@/lib/utils";

const TIMELINE_STEPS = [
  { status: 0, label: "Proposed" },
  { status: 1, label: "Active" },
  { status: 2, label: "Fulfilled" },
];

function statusToStep(status: number): number {
  if (status === 5) return -1; // cancelled
  if (status === 3 || status === 4) return 1; // breached/disputed = stuck at active
  return status;
}

export default function AgreementDetailPage() {
  const params = useParams();
  const pdaStr = params.id as string;
  const { data, isLoading, error } = useAgreementDetail(pdaStr);

  if (isLoading) return <ProfileSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        icon="❌"
        title="Agreement not found"
        description={error ? String(error) : "Agreement not found on-chain"}
      />
    );
  }

  const { agreement, parties } = data;
  const idHex = agreementIdToHex(agreement.agreementId);
  const isPrivate = agreement.visibility === 1;
  const termsUri = bytesToString(agreement.termsUri);
  const termsHash = bytesToHex(agreement.termsHash);
  const currentStep = statusToStep(agreement.status);
  const isCancelled = agreement.status === 5;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Agreement</h1>
          <StatusBadge status={agreement.status} />
        </div>
        <p className="text-gray-500 font-mono text-sm">{idHex}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>{AGREEMENT_TYPE_LABELS[agreement.agreementType] || "Unknown"}</span>
          <span>·</span>
          <span className={isPrivate ? "text-yellow-500" : ""}>
            {isPrivate ? "🔒 Private" : "🌐 Public"}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Lifecycle</h2>
        {isCancelled ? (
          <div className="text-center text-red-400 text-sm py-2">
            ✕ Agreement was cancelled
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {TIMELINE_STEPS.map((step, i) => {
              const reached = currentStep >= step.status;
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                        reached
                          ? "bg-purple-500/20 border-purple-400 text-purple-400"
                          : "border-gray-700 text-gray-600"
                      }`}
                    >
                      {reached ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-xs mt-1 ${
                        reached ? "text-purple-400" : "text-gray-600"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 ? (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        currentStep > step.status ? "bg-purple-400" : "bg-gray-700"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">
          Parties ({agreement.numSigned}/{agreement.numParties} signed)
        </h2>
        <div className="space-y-3">
          {parties.map(({ party, identity }) => {
            const agentKey = identity?.agentKey.toBase58() ?? party.account.agentIdentity.toBase58();
            return (
              <div
                key={party.publicKey.toBase58()}
                className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={`/agent/${identity ? identity.agentKey.toBase58() : party.account.agentIdentity.toBase58()}`}
                    className="text-purple-400 hover:text-purple-300 font-mono text-sm"
                  >
                    {shortenPubkey(agentKey, 6)}
                  </Link>
                  <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
                    {ROLE_LABELS[party.account.role] || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {party.account.escrowDeposited.toNumber() > 0 ? (
                    <span className="text-gray-400 text-xs">
                      {lamportsToSol(party.account.escrowDeposited)} SOL deposited
                    </span>
                  ) : null}
                  <span
                    className={
                      party.account.signed ? "text-green-400" : "text-gray-500"
                    }
                  >
                    {party.account.signed
                      ? `✓ Signed ${formatTimestamp(party.account.signedAt)}`
                      : "Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terms & Escrow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Terms</h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">Terms Hash</div>
              <div className="font-mono text-gray-400 text-xs break-all">
                {termsHash}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Terms URI</div>
              {isPrivate ? (
                <span className="text-yellow-400 text-xs">🔒 Encrypted</span>
              ) : termsUri ? (
                <a
                  href={termsUri.startsWith("http") ? termsUri : `https://arweave.net/${termsUri}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-xs font-mono break-all"
                >
                  {termsUri}
                </a>
              ) : (
                <span className="text-gray-500 text-xs">None</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Escrow</h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">Total Escrow</div>
              <div className="text-xl font-bold">
                {agreement.escrowTotal.toNumber() > 0
                  ? `${lamportsToSol(agreement.escrowTotal)} SOL`
                  : "None"}
              </div>
            </div>
            {agreement.escrowTotal.toNumber() > 0 ? (
              <div>
                <div className="text-gray-500 text-xs mb-1">Escrow Mint</div>
                <div className="font-mono text-gray-400 text-xs break-all">
                  {shortenPubkey(agreement.escrowMint, 8)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-1">Created</div>
            <div>{formatTimestamp(agreement.createdAt)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Expires</div>
            <div>
              {agreement.expiresAt.toNumber() > 0
                ? formatTimestamp(agreement.expiresAt)
                : "Never"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Proposer</div>
            <Link
              href={`/agent/${agreement.proposer.toBase58()}`}
              className="text-purple-400 hover:text-purple-300 font-mono text-xs"
            >
              {shortenPubkey(agreement.proposer, 6)}
            </Link>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">Agreement PDA</div>
            <div className="font-mono text-gray-400 text-xs break-all">
              {pdaStr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

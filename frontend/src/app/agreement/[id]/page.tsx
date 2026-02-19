"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";
import { useAgreementDetail } from "@/lib/hooks";
import { formatError } from "@/lib/errors";
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
  { status: 0, label: "Proposed", number: "01" },
  { status: 1, label: "Active", number: "02" },
  { status: 2, label: "Fulfilled", number: "03" },
];

function statusToStep(status: number): number {
  if (status === 5) return -1; // cancelled
  if (status === 3 || status === 4) return 1; // breached/disputed = stuck at active
  return status;
}

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      <div className="w-3 h-3 rounded-full bg-[#555]" />
      <div className="w-3 h-3 rounded-full bg-[#444]" />
      <div className="w-3 h-3 rounded-full bg-[#333]" />
    </div>
  );
}

function SignAction({ agreement, parties, pdaStr }: { agreement: any; parties: any[] | undefined; pdaStr: string }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isPending, startTransition] = useTransition();
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  if (!wallet.publicKey || agreement.status !== 0) return null; // Only show for PROPOSED

  // Check if current wallet is an unsigned party (by agent_identity field matching wallet or identity agentKey)
  const myPartyEntry = parties?.find((p) => {
    const pa = p.party.account;
    // Direct signer: agent_identity stores the raw wallet pubkey
    if (pa.agentIdentity.toBase58() === wallet.publicKey?.toBase58() && !pa.signed) return true;
    // Identity-based: identity's agentKey matches wallet
    const agentKey = p.identity?.agentKey?.toBase58();
    return agentKey === wallet.publicKey?.toBase58() && !pa.signed;
  });

  if (!myPartyEntry) return null;
  const partyToSign = myPartyEntry;

  const handleSign = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !partyToSign) return;
    setSignError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      // Try direct signing first (no identity required)
      const [directPartyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("party"), Buffer.from(agreement.agreementId), wallet.publicKey.toBuffer()],
        program.programId
      );

      try {
        await (program.methods as any)
          .signAgreementDirect(agreement.agreementId)
          .accounts({
            signer: wallet.publicKey,
            agreement: new PublicKey(pdaStr),
            party: directPartyPDA,
          })
          .rpc();
        setSigned(true);
        return;
      } catch {
        // Fall back to identity-based signing
      }

      // Identity-based signing
      const agentKey = partyToSign.identity?.agentKey || wallet.publicKey;
      const [signerIdentityPDA] = getAgentIdentityPDA(agentKey);

      await (program.methods as any)
        .signAgreement(agreement.agreementId)
        .accounts({
          signer: agentKey,
          signerIdentity: signerIdentityPDA,
          agreement: new PublicKey(pdaStr),
          party: partyToSign.party.publicKey,
        })
        .rpc();

      setSigned(true);
    } catch (err: unknown) {
      setSignError(formatError(err));
    }
  };

  if (signed) {
    return (
      <div className="mb-8 pb-8 border-b border-gray-200 text-center">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-gray-600 font-medium">Agreement signed! Refresh to see updated status.</p>
      </div>
    );
  }

  return (
    <div className="mb-8 pb-8 border-b border-gray-200">
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">✍️</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Signature Required</h3>
        <p className="text-sm text-gray-500 mb-4">
          This agreement is waiting for your signature. Review the terms above and sign to activate.
        </p>
        {signError && (
          <div className="mb-4 text-sm text-gray-500">⚠️ {signError}</div>
        )}
        <button
          onClick={() => startTransition(() => { handleSign(); })}
          disabled={isPending}
          className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-300 text-white font-medium py-3 px-8 rounded-lg transition-all"
        >
          {isPending ? "Signing..." : "Sign Agreement"}
        </button>
      </div>
    </div>
  );
}

export default function AgreementDetailPage() {
  const params = useParams();
  const pdaStr = params.id as string;
  const { data, isLoading, error } = useAgreementDetail(pdaStr);
  const { publicKey } = useWallet();

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

  // Check if connected wallet is a party to this agreement
  const isParty = publicKey && parties.some(
    (p: any) => {
      const agentKey = p.party?.account?.agentKey || p.identity?.account?.agentKey;
      const authority = p.identity?.account?.authority;
      return (
        (agentKey && publicKey.equals(agentKey)) ||
        (authority && publicKey.equals(authority))
      );
    }
  );

  // Private agreements: show only minimal info to non-parties
  if (isPrivate && !isParty) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-shell-heading">Agreement</h1>
            <StatusBadge status={agreement.status} />
          </div>
          <p className="text-shell-dim font-mono text-sm">{idHex}</p>
        </div>
        <div className="dark-card p-10 text-center">
          <div className="text-5xl mb-6">🔒</div>
          <h2 className="text-xl font-bold text-gray-400 mb-3">Private Agreement</h2>
          <p className="text-shell-muted text-sm max-w-md mx-auto leading-relaxed">
            This agreement is encrypted and only visible to its parties.
            Terms, party details, and escrow information are not publicly accessible.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-sm max-w-sm mx-auto">
            <div>
              <div className="text-shell-dim text-xs mb-1">Type</div>
              <div className="text-shell-fg">{AGREEMENT_TYPE_LABELS[agreement.agreementType] ?? "Unknown"}</div>
            </div>
            <div>
              <div className="text-shell-dim text-xs mb-1">Parties</div>
              <div className="text-shell-fg">{agreement.numParties}</div>
            </div>
            <div>
              <div className="text-shell-dim text-xs mb-1">Created</div>
              <div className="text-shell-fg">{formatTimestamp(agreement.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-shell-heading">Agreement</h1>
          <StatusBadge status={agreement.status} />
        </div>
        <p className="text-shell-dim font-mono text-sm">{idHex}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-shell-dim">
          <span className="font-medium">{AGREEMENT_TYPE_LABELS[agreement.agreementType] ?? "Unknown"}</span>
          <span>·</span>
          <span className={isPrivate ? "text-gray-500" : ""}>
            {isPrivate ? "🔒 Private" : "🌐 Public"}
          </span>
        </div>
      </div>

      {/* Timeline — numbered steps */}
      <div className="dark-card p-8 mb-8">
        <h2 className="text-sm uppercase tracking-wider text-shell-dim mb-6">Lifecycle</h2>
        {isCancelled ? (
          <div className="text-center text-gray-500 text-sm py-3 bg-white/5 rounded-lg border border-white/10">
            Agreement was cancelled
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {TIMELINE_STEPS.map((step, i) => {
              const reached = currentStep >= step.status;
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <span className={`text-2xl font-mono font-bold mb-2 ${reached ? "text-white" : "text-step-color"}`}>
                      {step.number}
                    </span>
                    <span className={`text-xs font-medium ${reached ? "text-white" : "text-shell-dim"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 ? (
                    <div
                      className={`flex-1 h-px mx-4 ${
                        currentStep > step.status ? "bg-white/30" : "bg-shell-border"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contract Document — white card */}
      <div className="document-card p-8 mb-8">
        <WindowDots />

        {/* Parties Section */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">
            Parties
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {agreement.numSigned}/{agreement.numParties} <span className="font-serif italic">signed</span>
          </p>
          <div className="space-y-3">
            {parties.map(({ party, identity }) => {
              const agentKey = identity?.agentKey.toBase58() ?? party.account.agentIdentity.toBase58();
              return (
                <div
                  key={party.publicKey.toBase58()}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 rounded-lg p-4 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/agent/${identity ? identity.agentKey.toBase58() : party.account.agentIdentity.toBase58()}`}
                      className="text-gray-600 hover:text-gray-500 font-mono text-sm font-medium"
                    >
                      {shortenPubkey(agentKey, 6)}
                    </Link>
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">
                      {ROLE_LABELS[party.account.role] ?? "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {party.account.escrowDeposited.toNumber() > 0 ? (
                      <span className="text-gray-500 text-xs">
                        {lamportsToSol(party.account.escrowDeposited)} SOL
                      </span>
                    ) : null}
                    <span
                      className={
                        party.account.signed ? "text-gray-600 font-medium" : "text-gray-400"
                      }
                    >
                      {party.account.signed
                        ? `✓ ${formatTimestamp(party.account.signedAt)}`
                        : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sign Action */}
        <SignAction agreement={agreement} parties={parties} pdaStr={pdaStr} />

        {/* Terms Section */}
        <div className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Terms</h2>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Terms Hash</div>
              <div className="font-mono text-gray-600 text-xs break-all bg-gray-50 rounded p-3">
                {termsHash}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Terms URI</div>
              {termsUri ? (
                <a
                  href={termsUri.startsWith("http") ? termsUri : `https://arweave.net/${termsUri}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-500 text-xs font-mono break-all"
                >
                  {termsUri}
                </a>
              ) : (
                <span className="text-gray-400 text-xs">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Escrow Section */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Escrow</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">
              {agreement.escrowTotal.toNumber() > 0
                ? lamportsToSol(agreement.escrowTotal)
                : "0"}
            </span>
            <span className="text-gray-400 text-sm">SOL</span>
          </div>
          {agreement.escrowTotal.toNumber() > 0 ? (
            <div className="mt-2 text-xs text-gray-400 font-mono">
              Mint: {shortenPubkey(agreement.escrowMint, 8)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Download Signed PDF */}
      {agreement.status !== 5 && (
        <div className="mb-8 flex justify-center">
          <a
            href={`/api/agreements/pdf?id=${pdaStr}`}
            download
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-shell-heading hover:bg-white/5 transition-colors text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Signed PDF
          </a>
        </div>
      )}

      {/* Metadata — dark card */}
      <div className="dark-card p-8">
        <h2 className="text-sm uppercase tracking-wider text-shell-dim mb-6">Details</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-shell-dim text-xs mb-1">Created</div>
            <div className="text-shell-fg">{formatTimestamp(agreement.createdAt)}</div>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Expires</div>
            <div className="text-shell-fg">
              {agreement.expiresAt.toNumber() > 0
                ? formatTimestamp(agreement.expiresAt)
                : "Never"}
            </div>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Proposer</div>
            <Link
              href={`/agent/${agreement.proposer.toBase58()}`}
              className="text-white hover:text-gray-300 font-mono text-xs"
            >
              {shortenPubkey(agreement.proposer, 6)}
            </Link>
          </div>
          <div>
            <div className="text-shell-dim text-xs mb-1">Agreement PDA</div>
            <div className="font-mono text-shell-muted text-xs break-all">
              {pdaStr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

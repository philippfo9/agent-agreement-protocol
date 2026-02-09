"use client";

import { useState, useTransition, useEffect } from "react";
import { useParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";
import { fetchAgentIdentity } from "@/lib/program";
import { formatError } from "@/lib/errors";
import { bytesToString } from "@/lib/utils";
import Link from "next/link";

export default function ClaimAgentPage() {
  const params = useParams();
  const agentPubkey = params.agentPubkey as string;
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [existingAuthority, setExistingAuthority] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");

  // Delegation scope fields
  const [canSign, setCanSign] = useState(true);
  const [canCommitFunds, setCanCommitFunds] = useState(false);
  const [maxCommit, setMaxCommit] = useState("0");
  const [expiresIn, setExpiresIn] = useState("0");

  let validPubkey = false;
  try {
    new PublicKey(agentPubkey);
    validPubkey = true;
  } catch {
    validPubkey = false;
  }

  const [pda] = validPubkey
    ? getAgentIdentityPDA(new PublicKey(agentPubkey))
    : [null];

  // Check if already claimed
  useEffect(() => {
    if (!validPubkey || !pda) return;
    fetchAgentIdentity(connection, pda).then((agent) => {
      if (agent) {
        setAlreadyClaimed(true);
        setExistingAuthority(agent.authority.toBase58());
      }
    });
  }, [connection, validPubkey, pda]);

  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !validPubkey) return;
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const agentKey = new PublicKey(agentPubkey);
      const [agentIdentityPDA] = getAgentIdentityPDA(agentKey);

      const metadataHash = new Array(32).fill(0);
      if (agentName) {
        const nameBytes = new TextEncoder().encode(agentName);
        for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
          metadataHash[i] = nameBytes[i];
        }
      }

      const expiresInDays = parseInt(expiresIn);
      const expiresAt =
        expiresInDays > 0
          ? new BN(Math.floor(Date.now() / 1000) + expiresInDays * 86400)
          : new BN(0);

      const scope = {
        canSignAgreements: canSign,
        canCommitFunds,
        maxCommitLamports: new BN(parseFloat(maxCommit) * 1e9),
        expiresAt,
      };

      await (program.methods as any)
        .registerAgent(agentKey, metadataHash, scope)
        .accounts({
          authority: wallet.publicKey,
          agentIdentity: agentIdentityPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(true);
    } catch (err: unknown) {
      setError(formatError(err));
    }
  };

  if (!validPubkey) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-shell-heading mb-2">Invalid Agent Key</h1>
          <p className="text-shell-muted text-sm">The agent public key in the URL is not valid.</p>
        </div>
      </div>
    );
  }

  if (alreadyClaimed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-shell-heading mb-2">Agent Already Claimed</h1>
          <p className="text-shell-muted text-sm mb-4">
            This agent identity has already been registered on-chain.
          </p>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-4 text-left">
            <div className="text-xs text-shell-dim uppercase tracking-wider mb-1">Agent Key</div>
            <div className="font-mono text-xs text-shell-muted break-all">{agentPubkey}</div>
            <div className="text-xs text-shell-dim uppercase tracking-wider mb-1 mt-3">Authority</div>
            <div className="font-mono text-xs text-shell-muted break-all">{existingAuthority}</div>
          </div>
          <Link
            href={`/agent/${agentPubkey}`}
            className="inline-block bg-white hover:bg-gray-200 text-black font-medium py-2.5 px-6 rounded-lg transition-all"
          >
            View Agent Profile →
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-shell-heading mb-2">Agent Claimed!</h1>
          <p className="text-shell-muted text-sm mb-4">
            You are now the authority for this agent. You can manage its delegation scopes and monitor its agreements.
          </p>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-6 text-left">
            <div className="text-xs text-shell-dim uppercase tracking-wider mb-1">Agent Key</div>
            <div className="font-mono text-xs text-shell-muted break-all">{agentPubkey}</div>
            <div className="text-xs text-shell-dim uppercase tracking-wider mb-1 mt-3">Your Authority</div>
            <div className="font-mono text-xs text-shell-muted break-all">{wallet.publicKey?.toBase58()}</div>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/agent/${agentPubkey}`}
              className="bg-white hover:bg-gray-200 text-black font-medium py-2.5 px-6 rounded-lg transition-all"
            >
              View Agent Profile →
            </Link>
            <Link
              href="/"
              className="bg-white/[0.05] hover:bg-white/10 text-shell-heading font-medium py-2.5 px-6 rounded-lg transition-all border border-white/10"
            >
              My Agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🤖</div>
          <h1 className="text-xl font-semibold text-shell-heading mb-2">Claim Agent Identity</h1>
          <p className="text-shell-muted text-sm">
            An AI agent is requesting you to be its human authority. Connect your wallet to register this agent on-chain and set its delegation boundaries.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-6">
          <div className="text-xs text-shell-dim uppercase tracking-wider mb-1">Agent Public Key</div>
          <div className="font-mono text-xs text-shell-muted break-all">{agentPubkey}</div>
        </div>

        {!wallet.publicKey ? (
          <div className="text-center">
            <p className="text-sm text-shell-muted mb-4">Connect your wallet to claim this agent.</p>
            <WalletMultiButton className="!bg-white !text-black hover:!bg-gray-200 !rounded-lg !font-medium !py-2.5 !px-6 !transition-all" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-shell-muted mb-1.5">
                Agent name (optional)
              </label>
              <input
                type="text"
                maxLength={32}
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. My Trading Agent"
                className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={canSign}
                  onChange={(e) => setCanSign(e.target.checked)}
                  className="rounded bg-input border-input-border text-white focus:ring-white/20"
                />
                <span className="text-sm text-shell-fg group-hover:text-shell-heading transition-colors">Can sign agreements</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={canCommitFunds}
                  onChange={(e) => setCanCommitFunds(e.target.checked)}
                  className="rounded bg-input border-input-border text-white focus:ring-white/20"
                />
                <span className="text-sm text-shell-fg group-hover:text-shell-heading transition-colors">Can commit funds</span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-shell-muted mb-1.5">Max commit per agreement (SOL limit, not transferred) — 0 = unlimited</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={maxCommit}
                onChange={(e) => setMaxCommit(e.target.value)}
                className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-shell-muted mb-1.5">Expires in (days) — 0 = never</label>
              <input
                type="number"
                min="0"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 text-sm text-shell-muted flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={() => startTransition(() => { handleClaim(); })}
              disabled={isPending}
              className="w-full bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              {isPending ? "Claiming..." : "Claim Agent Identity"}
            </button>

            <p className="text-xs text-shell-dim text-center">
              By claiming, you become this agent&apos;s on-chain authority. You can update delegation scopes or revoke access at any time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

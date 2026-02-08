"use client";

import { useState, useTransition } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";

interface RegisterAgentFormProps {
  onSuccess: () => void;
}

export function RegisterAgentForm({ onSuccess }: RegisterAgentFormProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [canSign, setCanSign] = useState(true);
  const [canCommitFunds, setCanCommitFunds] = useState(false);
  const [maxCommit, setMaxCommit] = useState("0");
  const [expiresIn, setExpiresIn] = useState("0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) return;

    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const agentKeypair = Keypair.generate();
      const [agentIdentityPDA] = getAgentIdentityPDA(agentKeypair.publicKey);

      const metadataHash = new Array(32).fill(0);
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
        .registerAgent(agentKeypair.publicKey, metadataHash, scope)
        .accounts({
          authority: wallet.publicKey,
          agentIdentity: agentIdentityPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register agent");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          handleSubmit(e);
        });
      }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-shell-heading">Register New Agent</h3>
        <p className="text-sm text-shell-muted mt-1">
          Creates a new agent identity bound to your wallet. A new keypair will be generated automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={canSign}
            onChange={(e) => setCanSign(e.target.checked)}
            className="rounded bg-input border-input-border text-accent focus:ring-accent"
          />
          <span className="text-sm text-shell-fg group-hover:text-shell-heading transition-colors">Can sign agreements</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={canCommitFunds}
            onChange={(e) => setCanCommitFunds(e.target.checked)}
            className="rounded bg-input border-input-border text-accent focus:ring-accent"
          />
          <span className="text-sm text-shell-fg group-hover:text-shell-heading transition-colors">Can commit funds</span>
        </label>
      </div>

      <div>
        <label className="block text-sm text-shell-muted mb-1.5">
          Max commit (SOL) — 0 = unlimited
        </label>
        <input
          type="number"
          step="0.001"
          min="0"
          value={maxCommit}
          onChange={(e) => setMaxCommit(e.target.value)}
          className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm text-shell-muted mb-1.5">
          Expires in (days) — 0 = never
        </label>
        <input
          type="number"
          min="0"
          value={expiresIn}
          onChange={(e) => setExpiresIn(e.target.value)}
          className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/30 transition-colors"
        />
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3.5 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !wallet.publicKey}
        className="w-full bg-accent hover:bg-accent-hover disabled:bg-shell-skeleton disabled:text-shell-dim text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
      >
        {isPending ? "Registering..." : "Register Agent"}
      </button>
    </form>
  );
}

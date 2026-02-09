"use client";

import { useState, useTransition } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { formatError } from "@/lib/errors";
import useSWR from "swr";

interface VaultPanelProps {
  agentIdentityPda: PublicKey;
}

function getVaultPDA(agentIdentityPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), agentIdentityPda.toBuffer()],
    new PublicKey(AAP_IDL.address)
  );
}

export function VaultPanel({ agentIdentityPda }: VaultPanelProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [vaultPda] = getVaultPDA(agentIdentityPda);

  const { data: vaultBalance, mutate } = useSWR(
    `vault:${vaultPda.toBase58()}`,
    async () => {
      try {
        const bal = await connection.getBalance(vaultPda);
        return bal;
      } catch {
        return 0;
      }
    },
    { refreshInterval: 5000 }
  );

  const handleDeposit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return;
    setError(null);
    setSuccess(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const lamports = new BN(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL));

      await (program.methods as any)
        .depositToVault(lamports)
        .accounts({
          authority: wallet.publicKey,
          agentIdentity: agentIdentityPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Deposited ${amount} SOL`);
      setAmount("");
      mutate();
    } catch (err: unknown) {
      setError(formatError(err));
    }
  };

  const handleWithdraw = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return;
    setError(null);
    setSuccess(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const lamports = new BN(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL));

      await (program.methods as any)
        .withdrawFromVault(lamports)
        .accounts({
          authority: wallet.publicKey,
          agentIdentity: agentIdentityPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Withdrew ${amount} SOL`);
      setAmount("");
      mutate();
    } catch (err: unknown) {
      setError(formatError(err));
    }
  };

  const balanceSol = vaultBalance !== undefined ? (vaultBalance / LAMPORTS_PER_SOL).toFixed(4) : "—";

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-shell-heading">Agent Vault</h3>
        <div className="text-right">
          <div className="text-xs text-shell-dim uppercase tracking-wider">Balance</div>
          <div className="text-xl font-mono text-shell-heading">{balanceSol} SOL</div>
        </div>
      </div>

      <p className="text-xs text-shell-dim">
        Deposit SOL for your agent to use in agreements. Only you (the authority) can deposit or withdraw.
      </p>

      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (SOL)"
          className="flex-1 bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
        />
        <button
          onClick={() => startTransition(() => { handleDeposit(); })}
          disabled={isPending || !amount || !wallet.publicKey}
          className="bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-2.5 px-5 rounded-lg transition-all text-sm"
        >
          Deposit
        </button>
        <button
          onClick={() => startTransition(() => { handleWithdraw(); })}
          disabled={isPending || !amount || !wallet.publicKey}
          className="bg-white/[0.05] hover:bg-white/10 border border-white/10 disabled:opacity-40 text-shell-fg font-medium py-2.5 px-5 rounded-lg transition-all text-sm"
        >
          Withdraw
        </button>
      </div>

      {error && (
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-sm text-shell-muted flex items-start gap-2">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-sm text-shell-fg flex items-start gap-2">
          <span>✅</span>
          <p>{success}</p>
        </div>
      )}

      <div className="text-[10px] text-shell-dim font-mono break-all">
        Vault: {vaultPda.toBase58()}
      </div>
    </div>
  );
}

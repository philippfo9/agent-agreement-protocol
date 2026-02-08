"use client";

import { useState, useTransition } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { AAP_IDL } from "@/lib/idl";
import { useMyAgents } from "@/lib/hooks";
import { AgentIdentityAccount } from "@/lib/types";
import { CardSkeletonList, EmptyState } from "@/components/Loading";
import { shortenPubkey, isExpired } from "@/lib/utils";

export default function EmergencyPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { data: agents, isLoading, mutate } = useMyAgents();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const revokeAgent = async (agent: AgentIdentityAccount) => {
    if (!publicKey || !wallet.signTransaction) return;
    setMessage(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      await (program.methods as any)
        .revokeAgent()
        .accounts({
          authority: publicKey,
          agentIdentity: agent.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setMessage({
        type: "success",
        text: `Agent ${shortenPubkey(agent.account.agentKey)} revoked successfully.`,
      });
      mutate();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to revoke agent",
      });
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center py-24">
        <h1 className="text-3xl font-bold tracking-tight text-red-400 mb-4">Emergency Controls</h1>
        <p className="text-gray-500 mb-8">
          Connect your wallet to access emergency agent controls.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-red-400">Emergency Controls</h1>
        <p className="text-gray-600 text-sm mt-2">
          Immediate actions to revoke agents and cancel agreements. Use with caution.
        </p>
      </div>

      <div className="dark-card border-red-500/20 p-6 mb-10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🚨</span>
          </div>
          <div>
            <h3 className="font-semibold text-red-400 text-sm">Danger Zone</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              These actions are irreversible. Revoking an agent closes its PDA and returns
              rent to your wallet. Any active agreements referencing this agent will be affected.
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-lg p-4 mb-8 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {isLoading ? (
        <CardSkeletonList count={2} />
      ) : !agents || agents.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No agents to manage"
          description="You have no registered agents."
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-gray-600 mb-4">Your Agents</h2>
          {agents.map((agent) => {
            const key = agent.publicKey.toBase58();
            const expired = isExpired(agent.account.scope.expiresAt);
            return (
              <div
                key={key}
                className="dark-card p-6 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm text-accent font-medium">
                      {shortenPubkey(agent.account.agentKey)}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
                        expired
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {expired ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 font-mono">
                    PDA: {shortenPubkey(agent.publicKey)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    startTransition(() => {
                      revokeAgent(agent);
                    });
                  }}
                  disabled={isPending}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 disabled:bg-white/[0.04] disabled:border-white/[0.06] disabled:text-gray-600 text-red-400 font-medium py-2.5 px-5 rounded-lg transition-all duration-200 text-sm"
                >
                  {isPending ? "Revoking..." : "Revoke Agent"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

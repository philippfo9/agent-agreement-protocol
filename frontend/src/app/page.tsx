"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMyAgents } from "@/lib/hooks";
import { AgentCard } from "@/components/AgentCard";
import { RegisterAgentForm } from "@/components/RegisterAgentForm";
import { CardSkeletonList, EmptyState } from "@/components/Loading";
import { isPubkeyDefault } from "@/lib/utils";

function HeroSection() {
  return (
    <div className="relative mb-10 md:mb-16 py-10 md:py-16 text-center">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-white/[0.03] via-white/[0.05] to-white/[0.03] blur-3xl rounded-full" />
      </div>
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-shell-heading">
        Agent Agreement
        <br />
        <span className="text-gray-400">
          Protocol
        </span>
      </h1>
      <p className="text-shell-muted text-base md:text-lg max-w-lg mx-auto leading-relaxed px-2">
        On-chain agent identity, delegation, and binding agreements on Solana.
        Register agents, define scopes, and create <span className="font-serif italic text-shell-fg">enforceable</span> agreements.
      </p>
      <div className="flex items-center justify-center gap-4 md:gap-6 mt-8 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="step-number">01</span>
          <span className="text-sm text-shell-muted">Register</span>
        </div>
        <div className="w-8 h-px bg-shell-border" />
        <div className="flex items-center gap-3">
          <span className="step-number">02</span>
          <span className="text-sm text-shell-muted">Delegate</span>
        </div>
        <div className="w-8 h-px bg-shell-border" />
        <div className="flex items-center gap-3">
          <span className="step-number">03</span>
          <span className="text-sm text-shell-muted">Agree</span>
        </div>
      </div>
    </div>
  );
}

export default function MyAgentsPage() {
  const { publicKey } = useWallet();
  const { data: agents, isLoading, mutate } = useMyAgents();
  const [showForm, setShowForm] = useState(false);

  if (!publicKey) {
    return (
      <div>
        <HeroSection />
        <div className="text-center">
          <p className="text-shell-muted mb-8">
            Connect your wallet to manage your on-chain agent identities.
          </p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  // Derived state — computed during render, not stored in state
  const rootAgents = agents?.filter((a) => isPubkeyDefault(a.account.parent)) ?? [];
  const subAgentsByParent = new Map<string, typeof rootAgents>();
  for (const agent of agents ?? []) {
    if (!isPubkeyDefault(agent.account.parent)) {
      const parentKey = agent.account.parent.toBase58();
      const existing = subAgentsByParent.get(parentKey) ?? [];
      existing.push(agent);
      subAgentsByParent.set(parentKey, existing);
    }
  }

  return (
    <div>
      <HeroSection />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-shell-heading">My Agents</h2>
          <p className="text-shell-dim text-sm mt-1">
            Register and manage agent identities bound to your wallet
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-white hover:bg-gray-200 text-black font-medium py-2.5 px-5 rounded-lg transition-all duration-200 text-sm"
        >
          {showForm ? "Cancel" : "+ New Agent"}
        </button>
      </div>

      {showForm ? (
        <div className="dark-card p-8 mb-10">
          <RegisterAgentForm
            onSuccess={() => {
              setShowForm(false);
              mutate();
            }}
          />
        </div>
      ) : null}

      {isLoading ? (
        <CardSkeletonList count={3} />
      ) : !agents || agents.length === 0 ? (
        <div className="dark-card p-8 text-center max-w-lg mx-auto">
          <div className="text-5xl mb-5">🤖</div>
          <h3 className="text-lg font-semibold text-shell-fg mb-3">No agents found for this wallet</h3>
          <div className="text-sm text-shell-muted text-left space-y-4">
            <p className="text-center">Get started with the Agent Agreement Protocol:</p>
            <div className="space-y-3">
              <div>
                <span className="font-medium text-shell-fg">1. Register a new agent</span>
                <span className="text-shell-dim"> — Create an on-chain identity with delegation boundaries</span>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-white hover:bg-gray-200 text-black font-medium py-2 px-5 rounded-lg transition-all duration-200 text-sm"
                >
                  + Register Agent
                </button>
              </div>
              <div>
                <span className="font-medium text-shell-fg">2. Already have an agent?</span>
                <span className="text-shell-dim"> — If a platform registered an agent for you, it will appear here once the program is deployed on Devnet.</span>
              </div>
            </div>
            <p className="text-xs text-shell-dim text-center pt-2">
              Need SOL? Get devnet tokens at{" "}
              <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-shell-fg transition-colors">
                faucet.solana.com
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6" style={{ contentVisibility: "auto" }}>
          {rootAgents.map((agent) => {
            const children = subAgentsByParent.get(agent.publicKey.toBase58()) ?? [];
            return (
              <div key={agent.publicKey.toBase58()}>
                <AgentCard agent={agent} />
                {children.length > 0 ? (
                  <div className="ml-4 md:ml-10 mt-3 space-y-3 border-l-2 border-shell-border pl-4 md:pl-6">
                    <div className="text-[11px] uppercase tracking-wider text-shell-dim mb-2">Sub-agents</div>
                    {children.map((child) => (
                      <AgentCard
                        key={child.publicKey.toBase58()}
                        agent={child}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

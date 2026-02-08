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
    <div className="relative mb-16 py-16 text-center">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 blur-3xl rounded-full" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight mb-4">
        Agent Agreement
        <br />
        <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Protocol
        </span>
      </h1>
      <p className="text-gray-500 text-lg max-w-lg mx-auto leading-relaxed">
        On-chain agent identity, delegation, and binding agreements on Solana.
        Register agents, define scopes, and create <span className="font-serif italic text-gray-400">enforceable</span> agreements.
      </p>
      <div className="flex items-center justify-center gap-6 mt-8">
        <div className="flex items-center gap-3">
          <span className="step-number">01</span>
          <span className="text-sm text-gray-400">Register</span>
        </div>
        <div className="w-8 h-px bg-white/10" />
        <div className="flex items-center gap-3">
          <span className="step-number">02</span>
          <span className="text-sm text-gray-400">Delegate</span>
        </div>
        <div className="w-8 h-px bg-white/10" />
        <div className="flex items-center gap-3">
          <span className="step-number">03</span>
          <span className="text-sm text-gray-400">Agree</span>
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
          <p className="text-gray-500 mb-8">
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

      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Agents</h2>
          <p className="text-gray-600 text-sm mt-1">
            Register and manage agent identities bound to your wallet
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-accent hover:bg-accent-hover text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200 text-sm"
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
        <EmptyState
          icon="🤖"
          title="No agents registered"
          description="Register your first agent to get started with the protocol."
        />
      ) : (
        <div className="space-y-6" style={{ contentVisibility: "auto" }}>
          {rootAgents.map((agent) => {
            const children = subAgentsByParent.get(agent.publicKey.toBase58()) ?? [];
            return (
              <div key={agent.publicKey.toBase58()}>
                <AgentCard agent={agent} />
                {children.length > 0 ? (
                  <div className="ml-10 mt-3 space-y-3 border-l-2 border-white/[0.06] pl-6">
                    <div className="text-[11px] uppercase tracking-wider text-gray-600 mb-2">Sub-agents</div>
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

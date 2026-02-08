"use client";

import { useState, useTransition } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMyAgents } from "@/lib/hooks";
import { AgentCard } from "@/components/AgentCard";
import { RegisterAgentForm } from "@/components/RegisterAgentForm";
import { CardSkeletonList, EmptyState } from "@/components/Loading";
import { isPubkeyDefault } from "@/lib/utils";

export default function MyAgentsPage() {
  const { publicKey } = useWallet();
  const { data: agents, isLoading, mutate } = useMyAgents();
  const [showForm, setShowForm] = useState(false);

  if (!publicKey) {
    return (
      <div className="text-center py-24">
        <h1 className="text-3xl font-bold mb-4">My Agents</h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to manage your on-chain agent identities.
        </p>
        <WalletMultiButton />
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Agents</h1>
          <p className="text-gray-500 text-sm mt-1">
            Register and manage agent identities bound to your wallet
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ New Agent"}
        </button>
      </div>

      {showForm ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
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
                  <div className="ml-8 mt-2 space-y-2 border-l-2 border-gray-800 pl-4">
                    <div className="text-xs text-gray-500 mb-1">Sub-agents</div>
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

"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMyAgents } from "@/lib/hooks";
import { AgentCard } from "@/components/AgentCard";
import { RegisterAgentForm } from "@/components/RegisterAgentForm";
import { CardSkeletonList } from "@/components/Loading";
import { isPubkeyDefault } from "@/lib/utils";
import Link from "next/link";

function HeroSection() {
  const [tab, setTab] = useState<"human" | "agent">("agent");
  const skillUrl = "https://raw.githubusercontent.com/philippfo9/agent-agreement-protocol/main/skill/SKILL.md";

  return (
    <div className="relative mb-10 md:mb-16 py-10 md:py-16 text-center">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-white/[0.03] via-white/[0.05] to-white/[0.03] blur-3xl rounded-full" />
      </div>
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-shell-heading">
        Agent Agreement
        <br />
        <span className="text-gray-400">Protocol</span>
      </h1>
      <p className="text-shell-muted text-base md:text-lg max-w-lg mx-auto leading-relaxed px-2">
        On-chain identity and binding agreements for AI agents on Solana.
      </p>

      {/* Tabbed getting started */}
      <div className="max-w-lg mx-auto mt-10">
        <div className="dark-card overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setTab("human")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "human"
                  ? "text-shell-heading bg-white/[0.05]"
                  : "text-shell-dim hover:text-shell-muted"
              }`}
            >
              I&apos;m a Human
            </button>
            <button
              onClick={() => setTab("agent")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "agent"
                  ? "text-shell-heading bg-white/[0.05]"
                  : "text-shell-dim hover:text-shell-muted"
              }`}
            >
              I&apos;m an Agent
            </button>
          </div>

          <div className="p-6">
            {tab === "agent" ? (
              <div className="space-y-5">
                {/* Command box */}
                <div className="bg-black/40 border border-white/10 rounded-lg p-4 font-mono text-sm text-shell-fg">
                  <span className="text-shell-dim select-none">$ </span>
                  curl -s {skillUrl}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`curl -s ${skillUrl}`)}
                  className="w-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-shell-fg font-medium py-2 px-4 rounded-lg transition-all text-sm"
                >
                  Copy command
                </button>
                <ol className="text-sm text-shell-muted text-left space-y-2">
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">1.</span>
                    Run the command above to get the AAP skill
                  </li>
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">2.</span>
                    Generate a keypair &amp; send your human the claim link
                  </li>
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">3.</span>
                    Start proposing &amp; signing on-chain agreements
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-shell-muted">
                  Your AI agent will generate a claim link for you. Open it to register the agent on-chain and set its delegation boundaries.
                </p>
                <ol className="text-sm text-shell-muted text-left space-y-2">
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">1.</span>
                    Give your agent the AAP skill
                  </li>
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">2.</span>
                    Agent sends you a claim link
                  </li>
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">3.</span>
                    Open link → connect wallet → set permissions
                  </li>
                  <li className="flex gap-3">
                    <span className="text-shell-fg font-medium">4.</span>
                    Monitor agreements in the{" "}
                    <Link href="/explore" className="underline hover:text-shell-fg transition-colors">
                      explorer
                    </Link>
                  </li>
                </ol>
                <div className="pt-2">
                  <WalletMultiButton className="!bg-white !text-black hover:!bg-gray-200 !rounded-lg !font-medium !py-2.5 !w-full !justify-center !transition-all" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyAgentsPage() {
  const { publicKey } = useWallet();
  const { data: agents, isLoading, mutate } = useMyAgents();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <HeroSection />

      {!publicKey ? (
        <div className="text-center mt-8">
          <Link
            href="/explore"
            className="text-sm text-shell-dim hover:text-shell-muted underline transition-colors"
          >
            Or browse the public agreement explorer →
          </Link>
        </div>
      ) : (
        <>
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
              <h3 className="text-lg font-semibold text-shell-fg mb-3">No agents yet</h3>
              <p className="text-sm text-shell-muted mb-4">
                Your agents will appear here once claimed. Give your AI agent the skill above, or register one manually.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-white hover:bg-gray-200 text-black font-medium py-2 px-5 rounded-lg transition-all duration-200 text-sm"
              >
                + Register Agent Manually
              </button>
            </div>
          ) : (
            <div className="space-y-6" style={{ contentVisibility: "auto" }}>
              {(agents?.filter((a) => isPubkeyDefault(a.account.parent)) ?? []).map((agent) => {
                const children = (agents ?? []).filter(
                  (a) => !isPubkeyDefault(a.account.parent) && a.account.parent.toBase58() === agent.publicKey.toBase58()
                );
                return (
                  <div key={agent.publicKey.toBase58()}>
                    <AgentCard agent={agent} />
                    {children.length > 0 ? (
                      <div className="ml-4 md:ml-10 mt-3 space-y-3 border-l-2 border-shell-border pl-4 md:pl-6">
                        <div className="text-[11px] uppercase tracking-wider text-shell-dim mb-2">Sub-agents</div>
                        {children.map((child) => (
                          <AgentCard key={child.publicKey.toBase58()} agent={child} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

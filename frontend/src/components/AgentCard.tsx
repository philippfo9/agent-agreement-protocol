"use client";

import Link from "next/link";
import { AgentIdentityAccount } from "@/lib/types";
import { shortenPubkey, formatTimestamp, lamportsToSol, isExpired, isPubkeyDefault } from "@/lib/utils";

function PubkeyGradient({ pubkey }: { pubkey: string }) {
  // Generate a deterministic gradient from pubkey chars
  const h1 = (pubkey.charCodeAt(0) * 7 + pubkey.charCodeAt(1) * 13) % 360;
  const h2 = (h1 + 60) % 360;
  return (
    <div
      className="w-10 h-10 rounded-lg flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${h1}, 60%, 50%), hsl(${h2}, 60%, 40%))` }}
    />
  );
}

export function AgentCard({ agent }: { agent: AgentIdentityAccount }) {
  const { account, publicKey } = agent;
  const expired = isExpired(account.scope.expiresAt);
  const hasParent = !isPubkeyDefault(account.parent);
  const agentKeyStr = account.agentKey.toBase58();

  return (
    <Link
      href={`/agent/${agentKeyStr}`}
      className="block dark-card p-6 hover:bg-white/[0.03] transition-all duration-200 group"
    >
      <div className="flex items-start gap-4 mb-5">
        <PubkeyGradient pubkey={agentKeyStr} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-mono text-accent font-medium">
              {shortenPubkey(account.agentKey)}
            </span>
            {hasParent ? (
              <span className="text-[10px] uppercase tracking-wider bg-white/[0.06] text-gray-500 px-2 py-0.5 rounded">
                Sub-agent
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-600 mt-1 font-mono">
            PDA: {shortenPubkey(publicKey)}
          </div>
        </div>
        <span
          className={`text-[11px] font-medium tracking-wide uppercase px-2.5 py-1 rounded-full ${
            expired
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-600 text-xs mb-1">Can Sign</div>
          <div className={account.scope.canSignAgreements ? "text-emerald-400" : "text-gray-500"}>
            {account.scope.canSignAgreements ? "✓ Yes" : "✗ No"}
          </div>
        </div>
        <div>
          <div className="text-gray-600 text-xs mb-1">Can Commit Funds</div>
          <div className={account.scope.canCommitFunds ? "text-emerald-400" : "text-gray-500"}>
            {account.scope.canCommitFunds ? "✓ Yes" : "✗ No"}
          </div>
        </div>
        <div>
          <div className="text-gray-600 text-xs mb-1">Max Commit</div>
          <div className="text-gray-300">
            {account.scope.maxCommitLamports.toNumber() === 0
              ? "Unlimited"
              : `${lamportsToSol(account.scope.maxCommitLamports)} SOL`}
          </div>
        </div>
        <div>
          <div className="text-gray-600 text-xs mb-1">Expires</div>
          <div className={expired ? "text-red-400" : "text-gray-300"}>
            {formatTimestamp(account.scope.expiresAt)}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.04] text-xs text-gray-600">
        Member since {formatTimestamp(account.createdAt)}
      </div>
    </Link>
  );
}

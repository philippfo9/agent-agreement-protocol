"use client";

import Link from "next/link";
import { AgentIdentityAccount } from "@/lib/types";
import { shortenPubkey, formatTimestamp, lamportsToSol, isExpired, isPubkeyDefault } from "@/lib/utils";

export function AgentCard({ agent }: { agent: AgentIdentityAccount }) {
  const { account, publicKey } = agent;
  const expired = isExpired(account.scope.expiresAt);
  const hasParent = !isPubkeyDefault(account.parent);

  return (
    <Link
      href={`/agent/${account.agentKey.toBase58()}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-purple-400">
              {shortenPubkey(account.agentKey)}
            </span>
            {hasParent && (
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                Sub-agent
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            PDA: {shortenPubkey(publicKey)}
          </div>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            expired
              ? "bg-red-500/10 text-red-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Can Sign</div>
          <div>{account.scope.canSignAgreements ? "✓ Yes" : "✗ No"}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Can Commit Funds</div>
          <div>{account.scope.canCommitFunds ? "✓ Yes" : "✗ No"}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Max Commit</div>
          <div>
            {account.scope.maxCommitLamports.toNumber() === 0
              ? "Unlimited"
              : `${lamportsToSol(account.scope.maxCommitLamports)} SOL`}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Expires</div>
          <div className={expired ? "text-red-400" : ""}>
            {formatTimestamp(account.scope.expiresAt)}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
        Created {formatTimestamp(account.createdAt)}
      </div>
    </Link>
  );
}

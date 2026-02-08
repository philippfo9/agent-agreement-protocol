"use client";

import Link from "next/link";
import { AgreementAccount } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@/lib/constants";
import {
  shortenPubkey,
  lamportsToSol,
  formatTimestamp,
  agreementIdToHex,
  bytesToString,
} from "@/lib/utils";

export function AgreementCard({ agreement }: { agreement: AgreementAccount }) {
  const { account, publicKey } = agreement;
  const idHex = agreementIdToHex(account.agreementId);
  const isPrivate = account.visibility === 1;
  const termsUri = bytesToString(account.termsUri);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-300">
              {idHex.slice(0, 8)}...
            </span>
            <StatusBadge status={account.status} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{AGREEMENT_TYPE_LABELS[account.agreementType] || "Unknown"}</span>
            <span>·</span>
            <span className={isPrivate ? "text-yellow-500" : ""}>
              {isPrivate ? "🔒 Private" : "🌐 Public"}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-gray-400">
            {account.numSigned}/{account.numParties} signed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <div className="text-gray-500 text-xs">Proposer</div>
          <Link
            href={`/agent/${account.proposer.toBase58()}`}
            className="text-purple-400 hover:text-purple-300 font-mono text-xs"
          >
            {shortenPubkey(account.proposer)}
          </Link>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Escrow</div>
          <div>
            {account.escrowTotal.toNumber() > 0
              ? `${lamportsToSol(account.escrowTotal)} SOL`
              : "None"}
          </div>
        </div>
      </div>

      {isPrivate ? (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400/80">
          🔒 Encrypted — only parties can view terms
        </div>
      ) : termsUri ? (
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 font-mono break-all">
          {termsUri}
        </div>
      ) : null}

      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <span>Created {formatTimestamp(account.createdAt)}</span>
        {account.expiresAt.toNumber() > 0 && (
          <span>Expires {formatTimestamp(account.expiresAt)}</span>
        )}
      </div>
    </div>
  );
}

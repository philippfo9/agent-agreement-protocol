"use client";

import Link from "next/link";
import { AgreementAccount } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import {
  AGREEMENT_TYPE_LABELS,
} from "@/lib/constants";
import {
  shortenPubkey,
  lamportsToSol,
  formatTimestamp,
  agreementIdToHex,
  bytesToString,
} from "@/lib/utils";

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <div className="w-2.5 h-2.5 rounded-full bg-[#555]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#444]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
    </div>
  );
}

export function AgreementCard({ agreement }: { agreement: AgreementAccount }) {
  const { account, publicKey } = agreement;
  const idHex = agreementIdToHex(account.agreementId);
  const isPrivate = account.visibility === 1;
  const termsUri = bytesToString(account.termsUri);

  return (
    <Link
      href={`/agreement/${publicKey.toBase58()}`}
      className="block document-card p-6 hover:shadow-document-hover transition-all duration-300"
    >
      <WindowDots />

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm text-gray-700 font-medium">
              {idHex.slice(0, 8)}…
            </span>
            <StatusBadge status={account.status} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{AGREEMENT_TYPE_LABELS[account.agreementType] ?? "Unknown"}</span>
            <span className="text-gray-300">·</span>
            <span className={isPrivate ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-500 dark:text-gray-400"}>
              {isPrivate ? "🔒 Private" : "Public"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-700 font-medium">
            {account.numSigned}/{account.numParties} <span className="font-serif italic text-gray-400 dark:text-gray-500 dark:text-gray-400">signed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs mb-1">Proposer</div>
          <span className="text-gray-600 dark:text-gray-300 font-mono text-xs font-medium">
            {shortenPubkey(account.proposer)}
          </span>
        </div>
        <div>
          <div className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs mb-1">Escrow</div>
          <div className="text-gray-700 font-medium">
            {account.escrowTotal.toNumber() > 0
              ? `${lamportsToSol(account.escrowTotal)} SOL`
              : "None"}
          </div>
        </div>
      </div>

      {isPrivate ? (
        <div className="bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300">
          🔒 Encrypted — only parties can view terms
        </div>
      ) : termsUri ? (
        <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
          {termsUri}
        </div>
      ) : null}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
        <span>Created {formatTimestamp(account.createdAt)}</span>
        {account.expiresAt.toNumber() > 0 ? (
          <span>Expires {formatTimestamp(account.expiresAt)}</span>
        ) : null}
      </div>
    </Link>
  );
}

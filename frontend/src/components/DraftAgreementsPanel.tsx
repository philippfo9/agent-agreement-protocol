"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { shortenPubkey } from "@/lib/utils";

export function DraftAgreementsPanel() {
  const { data: drafts, refetch } = trpc.listDrafts.useQuery();
  const approveDraft = trpc.approveDraft.useMutation({ onSuccess: () => refetch() });
  const rejectDraft = trpc.rejectDraft.useMutation({ onSuccess: () => refetch() });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingDrafts = drafts?.filter((d) => d.status === "pending") ?? [];

  const handleReject = async (id: string) => {
    await rejectDraft.mutateAsync({ draftId: id, reason: rejectReason || undefined });
    setRejectingId(null);
    setRejectReason("");
  };

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-8">
      <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-6">
        Pending Approvals ({pendingDrafts.length})
      </h2>

      {pendingDrafts.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">
          No pending agreements
        </div>
      ) : (
        <div className="space-y-3">
          {pendingDrafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-0.5 rounded text-xs text-white">
                    {draft.agreementType}
                  </span>
                  {draft.title ? (
                    <span className="text-sm text-white">{draft.title}</span>
                  ) : null}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(draft.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                {draft.counterpartyPubkey ? (
                  <div>
                    <div className="text-gray-500 mb-0.5">Counterparty</div>
                    <div className="font-mono text-gray-400">{shortenPubkey(draft.counterpartyPubkey)}</div>
                  </div>
                ) : null}
                {draft.escrowAmount != null ? (
                  <div>
                    <div className="text-gray-500 mb-0.5">Escrow</div>
                    <div className="font-mono text-gray-400">{String(draft.escrowAmount)} lamports</div>
                  </div>
                ) : null}
                {draft.durationDays != null ? (
                  <div>
                    <div className="text-gray-500 mb-0.5">Duration</div>
                    <div className="font-mono text-gray-400">{draft.durationDays} days</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-gray-500 mb-0.5">Agent</div>
                  <div className="font-mono text-gray-400">{shortenPubkey(draft.agentPubkey)}</div>
                </div>
              </div>

              {draft.description ? (
                <p className="text-xs text-gray-500 mb-4">{draft.description}</p>
              ) : null}

              {rejectingId === draft.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#3a3a3a]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(draft.id)}
                      disabled={rejectDraft.isPending}
                      className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      {rejectDraft.isPending ? "Rejecting..." : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                      className="text-gray-500 hover:text-gray-400 text-sm px-4 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveDraft.mutate({ draftId: draft.id })}
                    disabled={approveDraft.isPending}
                    className="bg-white hover:bg-gray-200 disabled:bg-gray-600 text-black text-sm px-4 py-2 rounded-lg transition-colors font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(draft.id)}
                    className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

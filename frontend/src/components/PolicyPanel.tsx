"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const AGREEMENT_TYPES = [
  { key: "safe", label: "SAFE" },
  { key: "service", label: "Service" },
  { key: "revenue-share", label: "Revenue Share" },
  { key: "partnership", label: "Partnership" },
  { key: "custom", label: "Custom" },
];

export function PolicyPanel({ agentPubkey }: { agentPubkey: string }) {
  const { data: policy, refetch } = trpc.getPolicy.useQuery({ agentPubkey });
  const setPolicy = trpc.setPolicy.useMutation({ onSuccess: () => refetch() });

  const [editing, setEditing] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [maxEscrow, setMaxEscrow] = useState<string>("");
  const [maxEscrowEnabled, setMaxEscrowEnabled] = useState(false);
  const [maxActive, setMaxActive] = useState<string>("");
  const [maxActiveEnabled, setMaxActiveEnabled] = useState(false);
  const [requireCosign, setRequireCosign] = useState(false);
  const [maxDuration, setMaxDuration] = useState<string>("");
  const [maxDurationEnabled, setMaxDurationEnabled] = useState(false);

  const startEdit = () => {
    if (policy) {
      setAllowedTypes(policy.allowedTypes);
      setMaxEscrowEnabled(policy.maxEscrowLamports != null);
      setMaxEscrow(policy.maxEscrowLamports != null ? String(policy.maxEscrowLamports) : "");
      setMaxActiveEnabled(policy.maxActiveAgreements != null);
      setMaxActive(policy.maxActiveAgreements != null ? policy.maxActiveAgreements.toString() : "");
      setRequireCosign(policy.requireHumanCosign);
      setMaxDurationEnabled(policy.maxDurationDays != null);
      setMaxDuration(policy.maxDurationDays != null ? policy.maxDurationDays.toString() : "");
    } else {
      setAllowedTypes([]);
      setMaxEscrow("");
      setMaxEscrowEnabled(false);
      setMaxActive("");
      setMaxActiveEnabled(false);
      setRequireCosign(false);
      setMaxDuration("");
      setMaxDurationEnabled(false);
    }
    setEditing(true);
  };

  const handleSave = async () => {
    await setPolicy.mutateAsync({
      agentPubkey,
      allowedTypes,
      maxEscrowLamports: maxEscrowEnabled && maxEscrow ? Number(maxEscrow) : null,
      maxActiveAgreements: maxActiveEnabled && maxActive ? parseInt(maxActive) : null,
      requireHumanCosign: requireCosign,
      maxDurationDays: maxDurationEnabled && maxDuration ? parseInt(maxDuration) : null,
    });
    setEditing(false);
  };

  const toggleType = (key: string) => {
    setAllowedTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  if (!editing) {
    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400">Agent Policy</h2>
          <button
            onClick={startEdit}
            className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {policy ? "Edit Policy" : "Set Policy"}
          </button>
        </div>

        {!policy ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            No policy set. Set constraints to control how this agent can enter agreements.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Allowed Types</div>
              <div className="flex flex-wrap gap-2">
                {policy.allowedTypes.length === 0 ? (
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm">All types allowed</span>
                ) : (
                  policy.allowedTypes.map((t) => (
                    <span key={t} className="bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1 rounded text-sm text-white">
                      {AGREEMENT_TYPES.find((at) => at.key === t)?.label ?? t}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Escrow</div>
                <div className="text-white text-sm font-mono">
                  {policy.maxEscrowLamports != null ? `${String(policy.maxEscrowLamports)} lamports` : "No limit"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Active</div>
                <div className="text-white text-sm font-mono">
                  {policy.maxActiveAgreements != null ? policy.maxActiveAgreements.toString() : "No limit"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Duration</div>
                <div className="text-white text-sm font-mono">
                  {policy.maxDurationDays != null ? `${policy.maxDurationDays} days` : "No limit"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Human Cosign</div>
                <div className="text-white text-sm">
                  {policy.requireHumanCosign ? "✓ Required" : "✗ Not required"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-8">
      <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Edit Agent Policy</h2>

      <div className="space-y-6">
        {/* Allowed types */}
        <div>
          <label className="block text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-2">Allowed Agreement Types</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Leave empty to allow all types</p>
          <div className="flex flex-wrap gap-2">
            {AGREEMENT_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleType(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  allowedTypes.includes(t.key)
                    ? "bg-white text-black border-white"
                    : "bg-[#1a1a1a] text-gray-400 dark:text-gray-500 dark:text-gray-400 border-[#2a2a2a] hover:border-[#3a3a3a]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max escrow */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">Max Escrow (lamports)</label>
            <button
              type="button"
              onClick={() => setMaxEscrowEnabled(!maxEscrowEnabled)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-400 dark:text-gray-500 dark:text-gray-400"
            >
              {maxEscrowEnabled ? "Remove limit" : "Set limit"}
            </button>
          </div>
          {maxEscrowEnabled ? (
            <input
              type="number"
              value={maxEscrow}
              onChange={(e) => setMaxEscrow(e.target.value)}
              placeholder="e.g. 1000000000"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder:text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#3a3a3a]"
            />
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm">No limit</div>
          )}
        </div>

        {/* Max active agreements */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">Max Active Agreements</label>
            <button
              type="button"
              onClick={() => setMaxActiveEnabled(!maxActiveEnabled)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-400 dark:text-gray-500 dark:text-gray-400"
            >
              {maxActiveEnabled ? "Remove limit" : "Set limit"}
            </button>
          </div>
          {maxActiveEnabled ? (
            <input
              type="number"
              value={maxActive}
              onChange={(e) => setMaxActive(e.target.value)}
              placeholder="e.g. 5"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder:text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#3a3a3a]"
            />
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm">No limit</div>
          )}
        </div>

        {/* Max duration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">Max Duration (days)</label>
            <button
              type="button"
              onClick={() => setMaxDurationEnabled(!maxDurationEnabled)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-400 dark:text-gray-500 dark:text-gray-400"
            >
              {maxDurationEnabled ? "Remove limit" : "Set limit"}
            </button>
          </div>
          {maxDurationEnabled ? (
            <input
              type="number"
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              placeholder="e.g. 365"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder:text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#3a3a3a]"
            />
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm">No limit</div>
          )}
        </div>

        {/* Require human cosign */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRequireCosign(!requireCosign)}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                requireCosign ? "bg-white" : "bg-[#2a2a2a]"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                  requireCosign ? "left-5 bg-black" : "left-1 bg-gray-50 dark:bg-white/50"
                }`}
              />
            </div>
            <div>
              <div className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">Require Human Cosign</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Agent proposals must be approved by you before going on-chain</div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={setPolicy.isPending}
            className="bg-white hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 dark:text-gray-500 dark:text-gray-400 text-black font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            {setPolicy.isPending ? "Saving..." : "Save Policy"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
        </div>

        {setPolicy.error ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            ⚠️ {setPolicy.error.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

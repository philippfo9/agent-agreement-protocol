"use client";

import { useState, useTransition, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";
import { useMyAgents } from "@/lib/hooks";
import { formatError } from "@/lib/errors";
import { AGREEMENT_TYPE_LABELS } from "@/lib/constants";
import Link from "next/link";

function randomAgreementId(): number[] {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}

function getAgreementPDA(agreementId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    new PublicKey(AAP_IDL.address)
  );
}

function getPartyPDA(agreementId: number[], identityPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("party"), Buffer.from(agreementId), identityPDA.toBuffer()],
    new PublicKey(AAP_IDL.address)
  );
}

export default function NewAgreementPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { data: myAgents } = useMyAgents();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ agreementPda: string; agreementId: string } | null>(null);

  // Form state
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [counterpartyKey, setCounterpartyKey] = useState("");
  const [agreementType, setAgreementType] = useState(1); // SERVICE default
  const [visibility, setVisibility] = useState(0); // PUBLIC default
  const [termsText, setTermsText] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Auto-select first agent
  useEffect(() => {
    if (myAgents && myAgents.length > 0 && !selectedAgent) {
      setSelectedAgent(myAgents[0].account.agentKey.toBase58());
    }
  }, [myAgents, selectedAgent]);

  // Check if user needs to register
  useEffect(() => {
    if (wallet.publicKey && myAgents && myAgents.length === 0) {
      setNeedsIdentity(true);
    } else {
      setNeedsIdentity(false);
    }
  }, [wallet.publicKey, myAgents]);

  const handleQuickRegister = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setIsRegistering(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      // Register wallet as its own agent (human identity)
      const [agentIdentityPDA] = getAgentIdentityPDA(wallet.publicKey);
      const metadataHash = new Array(32).fill(0);
      const nameBytes = new TextEncoder().encode("Human Signer");
      for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
        metadataHash[i] = nameBytes[i];
      }

      const scope = {
        canSignAgreements: true,
        canCommitFunds: false,
        maxCommitLamports: new BN(0),
        expiresAt: new BN(0),
      };

      await (program.methods as any)
        .registerAgent(wallet.publicKey, metadataHash, scope)
        .accounts({
          authority: wallet.publicKey,
          agentIdentity: agentIdentityPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setNeedsIdentity(false);
      setSelectedAgent(wallet.publicKey.toBase58());
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePropose = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !selectedAgent || !counterpartyKey) return;
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const agreementId = randomAgreementId();
      const [agreementPda] = getAgreementPDA(agreementId);

      const proposerKey = new PublicKey(selectedAgent);
      const [proposerIdentityPDA] = getAgentIdentityPDA(proposerKey);
      const [proposerPartyPDA] = getPartyPDA(agreementId, proposerIdentityPDA);

      // Hash terms
      const termsHash = new Array(32).fill(0);
      if (termsText) {
        const encoder = new TextEncoder();
        const data = encoder.encode(termsText);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = new Uint8Array(hashBuffer);
        for (let i = 0; i < 32; i++) termsHash[i] = hashArray[i];
      }

      // Terms URI (store terms text directly for now, truncated to 64 bytes)
      const termsUri = new Array(64).fill(0);
      if (termsText) {
        const uriBytes = new TextEncoder().encode(termsText.slice(0, 60));
        for (let i = 0; i < Math.min(uriBytes.length, 64); i++) termsUri[i] = uriBytes[i];
      }

      const days = parseInt(expiresInDays) || 90;
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + days * 86400);

      // Propose agreement (proposer auto-signs)
      await (program.methods as any)
        .proposeAgreement(
          agreementId,
          agreementType,
          visibility,
          termsHash,
          termsUri,
          2, // 2 parties
          expiresAt
        )
        .accounts({
          proposerSigner: proposerKey,
          proposerIdentity: proposerIdentityPDA,
          agreement: agreementPda,
          proposerParty: proposerPartyPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Add counterparty
      const counterparty = new PublicKey(counterpartyKey);
      const [counterpartyIdentityPDA] = getAgentIdentityPDA(counterparty);
      const [counterpartyPartyPDA] = getPartyPDA(agreementId, counterpartyIdentityPDA);

      await (program.methods as any)
        .addParty(agreementId, 1) // COUNTERPARTY role
        .accounts({
          proposerSigner: proposerKey,
          proposerIdentity: proposerIdentityPDA,
          agreement: agreementPda,
          partyIdentity: counterpartyIdentityPDA,
          party: counterpartyPartyPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const idHex = agreementId.map((b) => b.toString(16).padStart(2, "0")).join("");
      setSuccess({ agreementPda: agreementPda.toBase58(), agreementId: idHex });
    } catch (err: unknown) {
      setError(formatError(err));
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="text-5xl mb-6">📝</div>
        <h1 className="text-3xl font-bold text-shell-heading mb-4">New Agreement</h1>
        <p className="text-shell-muted mb-8">Connect your wallet to propose an on-chain agreement.</p>
        <WalletMultiButton />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="dark-card p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-shell-heading mb-2">Agreement Proposed!</h1>
          <p className="text-shell-muted text-sm mb-6">
            Your agreement is on-chain and waiting for the counterparty to sign.
          </p>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-6 text-left space-y-2">
            <div>
              <div className="text-xs text-shell-dim uppercase tracking-wider">Agreement ID</div>
              <div className="font-mono text-xs text-shell-muted break-all">{success.agreementId}</div>
            </div>
            <div>
              <div className="text-xs text-shell-dim uppercase tracking-wider">PDA</div>
              <div className="font-mono text-xs text-shell-muted break-all">{success.agreementPda}</div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/agreement/${success.agreementPda}`}
              className="bg-white hover:bg-gray-200 text-black font-medium py-2.5 px-6 rounded-lg transition-all"
            >
              View Agreement →
            </Link>
            <Link
              href="/explore"
              className="bg-white/[0.05] hover:bg-white/10 border border-white/10 text-shell-fg font-medium py-2.5 px-6 rounded-lg transition-all"
            >
              Explorer
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-shell-heading mb-2">New Agreement</h1>
        <p className="text-shell-muted text-sm">
          Create a binding on-chain agreement. Works for both AI agents and humans — like DocuSign on Solana.
        </p>
      </div>

      {needsIdentity ? (
        <div className="dark-card p-8 text-center">
          <div className="text-4xl mb-4">👤</div>
          <h2 className="text-lg font-semibold text-shell-heading mb-2">Register Your Identity</h2>
          <p className="text-sm text-shell-muted mb-6">
            To propose agreements, you need an on-chain identity. This is a one-time setup that links your wallet to the protocol.
          </p>
          <button
            onClick={handleQuickRegister}
            disabled={isRegistering}
            className="bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-8 rounded-lg transition-all"
          >
            {isRegistering ? "Registering..." : "Register as Human Signer"}
          </button>
          {error && (
            <div className="mt-4 text-sm text-shell-muted">⚠️ {error}</div>
          )}
        </div>
      ) : (
        <div className="dark-card p-8 space-y-6">
          {/* Proposer selection */}
          {myAgents && myAgents.length > 1 ? (
            <div>
              <label className="block text-sm text-shell-muted mb-1.5">Sign as</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {myAgents.map((agent) => {
                  const name = (() => {
                    try {
                      const bytes = agent.account.metadataHash;
                      const end = bytes.indexOf(0);
                      const slice = end === -1 ? bytes : bytes.slice(0, end);
                      return new TextDecoder().decode(new Uint8Array(slice));
                    } catch { return ""; }
                  })();
                  return (
                    <option key={agent.account.agentKey.toBase58()} value={agent.account.agentKey.toBase58()}>
                      {name || agent.account.agentKey.toBase58().slice(0, 12) + "..."}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          {/* Counterparty */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Counterparty (wallet or agent public key)</label>
            <input
              type="text"
              value={counterpartyKey}
              onChange={(e) => setCounterpartyKey(e.target.value)}
              placeholder="Enter Solana public key..."
              className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
            />
            <p className="text-xs text-shell-dim mt-1">The counterparty must also have a registered identity to sign.</p>
          </div>

          {/* Agreement type */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Agreement type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(AGREEMENT_TYPE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAgreementType(Number(value))}
                  className={`py-2 px-3 rounded-lg text-sm border transition-all ${
                    agreementType === Number(value)
                      ? "bg-white/10 border-white/30 text-shell-heading"
                      : "bg-white/[0.02] border-white/10 text-shell-dim hover:text-shell-muted hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility(0)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all ${
                  visibility === 0
                    ? "bg-white/10 border-white/30 text-shell-heading"
                    : "bg-white/[0.02] border-white/10 text-shell-dim hover:text-shell-muted"
                }`}
              >
                🌐 Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility(1)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all ${
                  visibility === 1
                    ? "bg-white/10 border-white/30 text-shell-heading"
                    : "bg-white/[0.02] border-white/10 text-shell-dim hover:text-shell-muted"
                }`}
              >
                🔒 Private
              </button>
            </div>
          </div>

          {/* Terms */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Terms (hashed on-chain, first 60 chars stored)</label>
            <textarea
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              rows={4}
              placeholder="Describe the agreement terms..."
              className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors resize-none"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Expires in (days)</label>
            <input
              type="number"
              min="1"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 text-sm text-shell-muted flex items-start gap-3">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={() => startTransition(() => { handlePropose(); })}
            disabled={isPending || !counterpartyKey}
            className="w-full bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-4 rounded-lg transition-all duration-200"
          >
            {isPending ? "Proposing..." : "Propose Agreement"}
          </button>

          <p className="text-xs text-shell-dim text-center">
            You will auto-sign as proposer. The counterparty will need to sign to activate the agreement.
          </p>
        </div>
      )}
    </div>
  );
}

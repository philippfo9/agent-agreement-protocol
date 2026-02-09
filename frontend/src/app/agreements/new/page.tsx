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
import { AGREEMENT_TEMPLATES } from "@/lib/templates";
import { DocumentUpload } from "@/components/DocumentUpload";
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
  const [counterparties, setCounterparties] = useState<string[]>([""]);
  const [agreementType, setAgreementType] = useState(1); // SERVICE default
  const [visibility, setVisibility] = useState(0); // PUBLIC default
  const [termsText, setTermsText] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [uploadedDoc, setUploadedDoc] = useState<{ key: string; url: string; hash: string; name: string; size: number; type: string } | null>(null);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

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

  const handleTemplateSelect = (index: number | null) => {
    setSelectedTemplate(index);
    if (index === null) {
      // Start from scratch
      setAgreementType(1);
      setVisibility(0);
      setTermsText("");
      setExpiresInDays("90");
    } else {
      const t = AGREEMENT_TEMPLATES[index];
      setAgreementType(t.type);
      setVisibility(t.visibility);
      setTermsText(t.terms);
      setExpiresInDays(t.expiresInDays);
    }
  };

  const addCounterparty = () => {
    if (counterparties.length < 7) {
      setCounterparties([...counterparties, ""]);
    }
  };

  const removeCounterparty = (index: number) => {
    setCounterparties(counterparties.filter((_, i) => i !== index));
  };

  const updateCounterparty = (index: number, value: string) => {
    const updated = [...counterparties];
    updated[index] = value;
    setCounterparties(updated);
  };

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
    const validCounterparties = counterparties.filter((k) => k.trim());
    if (!wallet.publicKey || !wallet.signTransaction || !selectedAgent || validCounterparties.length === 0) return;
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(AAP_IDL as any as Idl, provider);

      const agreementId = randomAgreementId();
      const [agreementPda] = getAgreementPDA(agreementId);

      const proposerKey = new PublicKey(selectedAgent);
      const [proposerIdentityPDA] = getAgentIdentityPDA(proposerKey);
      const [proposerPartyPDA] = getPartyPDA(agreementId, proposerIdentityPDA);

      // Hash terms — use uploaded doc hash if available, otherwise hash text
      const termsHash = new Array(32).fill(0);
      if (uploadedDoc) {
        // Use the document's SHA-256 hash
        for (let i = 0; i < 32; i++) {
          termsHash[i] = parseInt(uploadedDoc.hash.slice(i * 2, i * 2 + 2), 16);
        }
      } else if (termsText) {
        const encoder = new TextEncoder();
        const data = encoder.encode(termsText);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = new Uint8Array(hashBuffer);
        for (let i = 0; i < 32; i++) termsHash[i] = hashArray[i];
      }

      // Terms URI — use R2 key if doc uploaded, otherwise store text
      const termsUri = new Array(64).fill(0);
      if (uploadedDoc) {
        const uriBytes = new TextEncoder().encode(uploadedDoc.key.slice(0, 60));
        for (let i = 0; i < Math.min(uriBytes.length, 64); i++) termsUri[i] = uriBytes[i];
      } else if (termsText) {
        const uriBytes = new TextEncoder().encode(termsText.slice(0, 60));
        for (let i = 0; i < Math.min(uriBytes.length, 64); i++) termsUri[i] = uriBytes[i];
      }

      const days = parseInt(expiresInDays) || 90;
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + days * 86400);

      const numParties = validCounterparties.length + 1;

      // Propose agreement (proposer auto-signs)
      await (program.methods as any)
        .proposeAgreement(
          agreementId,
          agreementType,
          visibility,
          termsHash,
          termsUri,
          numParties,
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

      // Add each counterparty
      for (const cpKey of validCounterparties) {
        const counterparty = new PublicKey(cpKey.trim());
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
      }

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
            Your agreement is on-chain and waiting for {counterparties.filter((k) => k.trim()).length > 1 ? "all counterparties" : "the counterparty"} to sign.
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

  const validCounterparties = counterparties.filter((k) => k.trim());

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
          {/* Template selection */}
          <div>
            <label className="block text-sm text-shell-muted mb-2">Start from a template</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateSelect(null)}
                className={`py-2 px-3 rounded-lg text-sm border transition-all text-left ${
                  selectedTemplate === null
                    ? "bg-white/10 border-white/30 text-shell-heading"
                    : "bg-white/[0.02] border-white/10 text-shell-dim hover:text-shell-muted hover:border-white/20"
                }`}
              >
                ✏️ From scratch
              </button>
              {AGREEMENT_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleTemplateSelect(i)}
                  className={`py-2 px-3 rounded-lg text-sm border transition-all text-left ${
                    selectedTemplate === i
                      ? "bg-white/10 border-white/30 text-shell-heading"
                      : "bg-white/[0.02] border-white/10 text-shell-dim hover:text-shell-muted hover:border-white/20"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

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

          {/* Counterparties */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">
              Counterparties (wallet or agent public keys)
            </label>
            <div className="space-y-2">
              {counterparties.map((cp, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={cp}
                    onChange={(e) => updateCounterparty(i, e.target.value)}
                    placeholder={`Party ${i + 2} public key...`}
                    className="flex-1 bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors"
                  />
                  {counterparties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCounterparty(i)}
                      className="px-3 py-2.5 rounded-lg border border-white/10 text-shell-dim hover:text-shell-muted hover:border-white/20 transition-all text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-shell-dim">Each counterparty must have a registered identity to sign.</p>
              {counterparties.length < 7 && (
                <button
                  type="button"
                  onClick={addCounterparty}
                  className="text-xs text-shell-muted hover:text-shell-heading transition-colors"
                >
                  + Add party
                </button>
              )}
            </div>
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

          {/* Document Upload */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Attach document (optional — PDF, image, or text)</label>
            <DocumentUpload
              onUpload={(doc) => setUploadedDoc(doc)}
              document={uploadedDoc}
            />
          </div>

          {/* Terms */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">
              {uploadedDoc ? "Additional notes (optional)" : "Terms (hashed on-chain, first 60 chars stored)"}
            </label>
            <textarea
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              rows={uploadedDoc ? 3 : 6}
              placeholder={uploadedDoc ? "Add notes about this agreement..." : "Describe the agreement terms..."}
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
            disabled={isPending || validCounterparties.length === 0}
            className="w-full bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-4 rounded-lg transition-all duration-200"
          >
            {isPending ? "Proposing..." : `Propose Agreement (${validCounterparties.length + 1} parties)`}
          </button>

          <p className="text-xs text-shell-dim text-center">
            You will auto-sign as proposer. {validCounterparties.length > 1 ? "All counterparties" : "The counterparty"} will need to sign to activate the agreement.
          </p>
        </div>
      )}
    </div>
  );
}

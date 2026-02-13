"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";
import { useMyAgents } from "@/lib/hooks";
import { formatError } from "@/lib/errors";
import { AGREEMENT_TYPE_LABELS } from "@/lib/constants";
import { AGREEMENT_TEMPLATES, TEMPLATE_PDFS } from "@/lib/templates";
import { DocumentUpload } from "@/components/DocumentUpload";
import { trpc } from "@/lib/trpc";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [signerName, setSignerName] = useState("");
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const createAgreement = trpc.createAgreement.useMutation();
  const createDraft = trpc.createDraft.useMutation();
  const [draftSuccess, setDraftSuccess] = useState(false);
  const [policyViolation, setPolicyViolation] = useState<string | null>(null);

  // Map numeric agreement type to string for policy check
  const typeMap: Record<number, string> = { 0: "safe", 1: "service", 2: "revenue-share", 3: "partnership", 4: "custom" };

  // Fetch policy for selected agent
  const { data: policyCheck } = trpc.checkPolicy.useQuery(
    {
      agentPubkey: selectedAgent,
      agreementType: typeMap[agreementType] ?? "custom",
      durationDays: parseInt(expiresInDays) || null,
    },
    { enabled: !!selectedAgent }
  );

  const { data: agentPolicy } = trpc.getPolicy.useQuery(
    { agentPubkey: selectedAgent },
    { enabled: !!selectedAgent }
  );

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

      // Register wallet as its own agent (human signer — agent_key == authority)
      const [agentIdentityPDA] = getAgentIdentityPDA(wallet.publicKey);
      const metadataHash = new Array(32).fill(0);
      const nameBytes = new TextEncoder().encode(signerName || "Myself");
      for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
        metadataHash[i] = nameBytes[i];
      }

      const scope = {
        canSignAgreements: true,
        canCommitFunds: false,
        maxCommitLamports: new BN(0),
        expiresAt: new BN(0), // no expiry for human identity
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
    setPolicyViolation(null);
    setIsSubmitting(true);

    // Validate counterparty pubkeys
    for (const cpKey of validCounterparties) {
      try {
        new PublicKey(cpKey.trim());
      } catch {
        setError(`Invalid public key: ${cpKey.trim().slice(0, 12)}...`);
        return;
      }
    }

    // Check policy constraints
    if (policyCheck && !policyCheck.allowed) {
      setPolicyViolation(policyCheck.violations.join("\n"));
      setIsSubmitting(false);
      return;
    }

    // If cosign required, create draft instead
    if (policyCheck?.requiresCosign) {
      try {
        const termsHash = termsText
          ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(termsText).buffer as ArrayBuffer)))
              .map((b) => b.toString(16).padStart(2, "0")).join("")
          : "0".repeat(64);

        await createDraft.mutateAsync({
          agentPubkey: selectedAgent,
          agreementType: typeMap[agreementType] ?? "custom",
          counterpartyPubkey: validCounterparties[0] || null,
          termsHash,
          termsUri: uploadedDoc?.key ?? null,
          isPublic: visibility === 0,
          durationDays: parseInt(expiresInDays) || null,
          title: signerName || null,
          description: termsText.slice(0, 200) || null,
        });
        setDraftSuccess(true);
        setIsSubmitting(false);
        return;
      } catch (err: unknown) {
        setError(formatError(err));
        setIsSubmitting(false);
        return;
      }
    }

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
        const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
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

      // Add each counterparty using addPartyDirect (no registration required)
      for (const cpKey of validCounterparties) {
        const counterpartyPubkey = new PublicKey(cpKey.trim());
        const [counterpartyPartyPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("party"), Buffer.from(agreementId), counterpartyPubkey.toBuffer()],
          program.programId
        );

        await (program.methods as any)
          .addPartyDirect(agreementId, counterpartyPubkey, 1) // COUNTERPARTY role
          .accounts({
            proposerSigner: proposerKey,
            proposerIdentity: proposerIdentityPDA,
            agreement: agreementPda,
            party: counterpartyPartyPDA,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      const idHex = agreementId.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Save to database (for private agreements + document storage)
      try {
        const allPartyWallets = [
          { walletPubkey: wallet.publicKey!.toBase58(), role: "proposer" },
          ...validCounterparties.map((cp) => ({ walletPubkey: cp, role: "counterparty" })),
        ];
        await createAgreement.mutateAsync({
          agreementPda: agreementPda.toBase58(),
          agreementIdHex: idHex,
          visibility,
          documentKey: uploadedDoc?.key,
          documentName: uploadedDoc?.name,
          documentHash: uploadedDoc?.hash,
          termsText: termsText || undefined,
          parties: allPartyWallets,
          signerName: signerName || undefined,
        });
      } catch {
        // Non-critical — on-chain is the source of truth
      }

      setSuccess({ agreementPda: agreementPda.toBase58(), agreementId: idHex });
    } catch (err: unknown) {
      console.error("Propose agreement error:", err);
      setError(formatError(err));
    } finally {
      setIsSubmitting(false);
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

  if (draftSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="dark-card p-8 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-shell-heading mb-2">Agreement Submitted for Approval</h1>
          <p className="text-shell-muted text-sm mb-6">
            This agent requires human cosign. Your agreement proposal has been submitted as a draft and is awaiting approval from the agent&apos;s authority.
          </p>
          <Link
            href="/agreements"
            className="bg-white hover:bg-gray-200 text-black font-medium py-2.5 px-6 rounded-lg transition-all inline-block"
          >
            View My Agreements →
          </Link>
        </div>
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

      {/* Policy cosign banner */}
      {agentPolicy?.requireHumanCosign && selectedAgent ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 mb-6 flex items-start gap-3 text-sm text-gray-400">
          <span>⚠️</span>
          <p>This agent requires human approval for new agreements. Your proposal will be submitted as a draft for review.</p>
        </div>
      ) : null}

      {needsIdentity ? (
        <div className="dark-card p-8 text-center">
          <div className="text-4xl mb-4">✍️</div>
          <h2 className="text-lg font-semibold text-shell-heading mb-2">Sign as Human</h2>
          <p className="text-sm text-shell-muted mb-6">
            Create an on-chain signing identity linked to your wallet. This is a one-time setup — your wallet stays in full control.
          </p>
          <div className="max-w-xs mx-auto mb-4">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-shell-fg placeholder:text-shell-dim focus:outline-none focus:border-white/30"
            />
          </div>
          <button
            onClick={handleQuickRegister}
            disabled={isRegistering}
            className="bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-8 rounded-lg transition-all"
          >
            {isRegistering ? "Creating identity..." : "Create Signing Identity"}
          </button>
          <p className="text-xs text-shell-dim mt-3">
            Generates a signing key under your wallet authority. Costs ~0.002 SOL (rent, reclaimable).
          </p>
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
            {selectedTemplate !== null && TEMPLATE_PDFS[AGREEMENT_TEMPLATES[selectedTemplate].name] && (
              <a
                href={TEMPLATE_PDFS[AGREEMENT_TEMPLATES[selectedTemplate].name]}
                download
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-shell-muted hover:text-shell-heading transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF template
              </a>
            )}
          </div>

          {/* Proposer selection */}
          {myAgents && myAgents.length > 0 ? (
            <div>
              <label className="block text-sm text-shell-muted mb-1.5">Sign as</label>
              <select
                value={selectedAgent}
                onChange={(e) => {
                  if (e.target.value === "__register_self__") {
                    handleQuickRegister();
                  } else {
                    setSelectedAgent(e.target.value);
                  }
                }}
                className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {myAgents.map((agent) => {
                  const isSelf = wallet.publicKey && agent.account.agentKey.toBase58() === wallet.publicKey.toBase58();
                  const name = (() => {
                    if (isSelf) return "✍️ Myself";
                    try {
                      const bytes = agent.account.metadataHash;
                      const end = bytes.indexOf(0);
                      const slice = end === -1 ? bytes : bytes.slice(0, end);
                      const decoded = new TextDecoder().decode(new Uint8Array(slice));
                      return decoded === "Myself" || decoded === "Human Signer" ? "✍️ Myself" : decoded;
                    } catch { return ""; }
                  })();
                  return (
                    <option key={agent.account.agentKey.toBase58()} value={agent.account.agentKey.toBase58()}>
                      {name || agent.account.agentKey.toBase58().slice(0, 12) + "..."}
                    </option>
                  );
                })}
                {wallet.publicKey && !myAgents.some((a) => a.account.agentKey.toBase58() === wallet.publicKey!.toBase58()) && (
                  <option value="__register_self__">
                    ✍️ Sign as myself ({wallet.publicKey.toBase58().slice(0, 8)}...)
                  </option>
                )}
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
              <p className="text-xs text-shell-dim">Any Solana wallet can be a counterparty — no registration needed to sign.</p>
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

          {/* Signer name */}
          <div>
            <label className="block text-sm text-shell-muted mb-1.5">Your name (for signature)</label>
            <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="e.g. John Smith" className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 text-sm text-input-text placeholder:text-shell-dim focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10 transition-colors" />
            <p className="text-xs text-shell-dim mt-1">Displayed as your signature on the agreement.</p>
          </div>

          {policyViolation ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-sm text-gray-400 flex items-start gap-3">
              <span>🚫</span>
              <div>
                <p className="font-medium text-white mb-1">Policy Violation</p>
                <p className="whitespace-pre-line">{policyViolation}</p>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 text-sm text-shell-muted flex items-start gap-3">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handlePropose}
            disabled={isSubmitting || validCounterparties.length === 0}
            className="w-full bg-white hover:bg-gray-200 disabled:bg-shell-skeleton disabled:text-shell-dim text-black font-medium py-3 px-4 rounded-lg transition-all duration-200"
          >
            {isSubmitting ? "Proposing..." : `Propose Agreement (${validCounterparties.length + 1} parties)`}
          </button>

          <p className="text-xs text-shell-dim text-center">
            You will auto-sign as proposer. {validCounterparties.length > 1 ? "All counterparties" : "The counterparty"} will need to sign to activate the agreement.
          </p>
        </div>
      )}
    </div>
  );
}

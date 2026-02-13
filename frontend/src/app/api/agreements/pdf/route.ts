import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { jsPDF } from "jspdf";

const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

const AGREEMENT_TYPE_LABELS: Record<number, string> = {
  0: "Generic", 1: "Service Agreement", 2: "Revenue Share", 3: "Joint Venture", 4: "Custom / NDA",
};
const ROLE_LABELS: Record<number, string> = {
  0: "Proposer", 1: "Counterparty", 2: "Witness", 3: "Arbitrator",
};
const STATUS_LABELS: Record<number, string> = {
  0: "Proposed", 1: "Active", 2: "Fulfilled", 3: "Breached", 4: "Disputed", 5: "Cancelled",
};

function shortenPubkey(key: string, chars = 8): string {
  return `${key.slice(0, chars)}...${key.slice(-chars)}`;
}
function formatDate(timestamp: number): string {
  if (timestamp === 0) return "N/A";
  return new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function bytesToString(bytes: number[]): string {
  return Buffer.from(bytes).toString("utf-8").replace(/\0/g, "").trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agreementPda = searchParams.get("id");

  if (!agreementPda) {
    return NextResponse.json({ error: "Missing agreement id" }, { status: 400 });
  }

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const dummyKeypair = Keypair.generate();
    const dummyWallet = {
      publicKey: dummyKeypair.publicKey,
      signAllTransactions: async <T,>(txs: T[]) => txs,
      signTransaction: async <T,>(tx: T) => tx,
    };
    const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: "confirmed" });

    const idlModule = await import("@/lib/idl");
    const program = new Program(idlModule.AAP_IDL as any as Idl, provider);

    const agreementKey = new PublicKey(agreementPda);
    const agreement = await (program.account as any).agreement.fetch(agreementKey);

    const allParties = await (program.account as any).agreementParty.all([
      { memcmp: { offset: 8, bytes: agreementKey.toBase58() } },
    ]);

    const partiesWithIdentity = await Promise.all(
      allParties.map(async (p: any) => {
        try {
          const identity = await (program.account as any).agentIdentity.fetch(p.account.agentIdentity);
          return { party: p, identity };
        } catch {
          return { party: p, identity: null };
        }
      })
    );

    const pdfBuffer = generateSignedPDF(agreement, partiesWithIdentity, agreementPda);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AAP-Agreement-${agreementPda.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate PDF" }, { status: 500 });
  }
}

function generateSignedPDF(
  agreement: any,
  parties: { party: any; identity: any }[],
  pdaStr: string
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210; // page width mm
  const margin = 20;
  const contentWidth = pw - 2 * margin;
  let y = 20;

  const typeLabel = AGREEMENT_TYPE_LABELS[agreement.agreementType] ?? "Agreement";
  const statusLabel = STATUS_LABELS[agreement.status] ?? "Unknown";
  const idHex = bytesToHex(Array.from(agreement.agreementId));
  const termsHash = bytesToHex(Array.from(agreement.termsHash));
  const termsUri = bytesToString(Array.from(agreement.termsUri));

  // Header
  doc.setFontSize(8).setTextColor(136, 136, 136);
  doc.text("AGENT AGREEMENT PROTOCOL", pw / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(7).setTextColor(170, 170, 170);
  doc.text("On-chain Agreement Record — Solana Devnet", pw / 2, y, { align: "center" });
  y += 10;

  // Title
  doc.setFontSize(20).setTextColor(0, 0, 0).setFont("helvetica", "bold");
  doc.text(typeLabel.toUpperCase(), pw / 2, y, { align: "center" });
  y += 8;

  // Status
  const sc = agreement.status === 1 ? [22, 163, 74] : agreement.status === 2 ? [37, 99, 235] : agreement.status === 0 ? [202, 138, 4] : [220, 38, 38];
  doc.setFontSize(11).setTextColor(sc[0], sc[1], sc[2]).setFont("helvetica", "normal");
  doc.text(`Status: ${statusLabel}`, pw / 2, y, { align: "center" });
  y += 6;

  // Divider
  doc.setDrawColor(220, 220, 220).line(margin, y, pw - margin, y);
  y += 8;

  // Agreement Details
  doc.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "bold");
  doc.text("AGREEMENT DETAILS", margin, y);
  y += 7;

  const details: [string, string][] = [
    ["Agreement ID:", idHex],
    ["Agreement PDA:", pdaStr],
    ["Type:", typeLabel],
    ["Visibility:", agreement.visibility === 0 ? "Public" : "Private"],
    ["Created:", formatDate(agreement.createdAt.toNumber())],
    ["Expires:", agreement.expiresAt.toNumber() > 0 ? formatDate(agreement.expiresAt.toNumber()) : "No expiration"],
    ["Parties:", `${agreement.numSigned}/${agreement.numParties} signed`],
    ["Network:", "Solana Devnet"],
  ];

  doc.setFontSize(9);
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold").setTextColor(51, 51, 51);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 35, y);
    y += 5;
  }
  y += 5;

  // Terms
  doc.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "bold");
  doc.text("TERMS", margin, y);
  y += 7;
  doc.setFontSize(8).setTextColor(51, 51, 51).setFont("helvetica", "normal");
  doc.text("Terms Hash (SHA-256):", margin, y);
  y += 4;
  doc.setFont("courier", "normal").setFontSize(7).setTextColor(85, 85, 85);
  doc.text(termsHash, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(51, 51, 51);
  doc.text("Terms URI:", margin, y);
  y += 4;
  doc.setFont("courier", "normal").setFontSize(7).setTextColor(85, 85, 85);
  doc.text(termsUri || "None", margin, y);
  y += 8;

  // Escrow
  const escrowSol = agreement.escrowTotal.toNumber() / 1e9;
  if (escrowSol > 0) {
    doc.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "bold");
    doc.text("ESCROW", margin, y);
    y += 7;
    doc.setFontSize(10).setTextColor(51, 51, 51).setFont("helvetica", "normal");
    doc.text(`Total Escrowed: ${escrowSol.toFixed(4)} SOL`, margin, y);
    y += 8;
  }

  // Signatures
  doc.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "bold");
  doc.text("SIGNATURES", margin, y);
  y += 8;

  for (const { party, identity } of parties) {
    if (y > 260) { doc.addPage(); y = 20; }

    const p = party.account;
    const role = ROLE_LABELS[p.role] ?? "Party";
    const agentKey = identity?.agentKey?.toBase58() ?? p.agentIdentity.toBase58();
    const authority = identity?.authority?.toBase58() ?? agentKey;
    const signed = p.signed;
    const signedAt = signed ? formatDate(p.signedAt.toNumber()) : null;

    const boxH = signed ? 28 : 22;
    doc.setDrawColor(signed ? 22 : 220, signed ? 163 : 220, signed ? 74 : 220);
    doc.roundedRect(margin, y, contentWidth, boxH, 2, 2);
    doc.stroke();

    doc.setFontSize(9).setTextColor(0, 0, 0).setFont("helvetica", "bold");
    doc.text(role.toUpperCase(), margin + 3, y + 5);

    doc.setFontSize(7).setTextColor(85, 85, 85).setFont("courier", "normal");
    doc.text(`Agent: ${agentKey}`, margin + 3, y + 10);
    doc.text(`Authority: ${authority}`, margin + 3, y + 14);

    if (signed && signedAt) {
      doc.setFontSize(12).setTextColor(26, 26, 26).setFont("helvetica", "bolditalic");
      doc.text(shortenPubkey(agentKey, 12), margin + 110, y + 6);
      doc.setFontSize(7).setTextColor(22, 163, 74).setFont("helvetica", "bold");
      doc.text("SIGNED", margin + 110, y + 11);
      doc.setFont("helvetica", "normal").setTextColor(136, 136, 136);
      doc.text(signedAt, margin + 125, y + 11);
      doc.setFontSize(6).setTextColor(170, 170, 170).setFont("courier", "normal");
      doc.text(`Party PDA: ${party.publicKey.toBase58()}`, margin + 3, y + 20);
    } else {
      doc.setFontSize(9).setTextColor(202, 138, 4).setFont("helvetica", "bold");
      doc.text("PENDING", margin + 110, y + 10);
    }

    y += boxH + 5;
  }

  // Footer
  y = Math.max(y + 5, 265);
  if (y > 280) { doc.addPage(); y = 20; }
  doc.setDrawColor(220, 220, 220).line(margin, y, pw - margin, y);
  y += 5;

  doc.setFontSize(6).setTextColor(170, 170, 170).setFont("helvetica", "normal");
  const footer1 = "This document is a cryptographically verifiable record of an on-chain agreement on the Solana blockchain. All signatures are Ed25519 digital signatures verified by the Agent Agreement Protocol smart contract.";
  doc.text(footer1, pw / 2, y, { align: "center", maxWidth: contentWidth });
  y += 8;
  doc.text(
    `Generated: ${new Date().toISOString()} | Program: ${PROGRAM_ID.toBase58()} | Verify: https://frontend-ten-livid-87.vercel.app/agreement/${pdaStr}`,
    pw / 2, y, { align: "center", maxWidth: contentWidth }
  );

  return Buffer.from(doc.output("arraybuffer"));
}

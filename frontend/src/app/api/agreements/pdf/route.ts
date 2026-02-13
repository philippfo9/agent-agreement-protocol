import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
// @ts-expect-error pdfkit types
import PDFDocument from "pdfkit";

const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

const AGREEMENT_TYPE_LABELS: Record<number, string> = {
  0: "Generic",
  1: "Service Agreement",
  2: "Revenue Share",
  3: "Joint Venture",
  4: "Custom / NDA",
};

const ROLE_LABELS: Record<number, string> = {
  0: "Proposer",
  1: "Counterparty",
  2: "Witness",
  3: "Arbitrator",
};

const STATUS_LABELS: Record<number, string> = {
  0: "Proposed",
  1: "Active",
  2: "Fulfilled",
  3: "Breached",
  4: "Disputed",
  5: "Cancelled",
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
    const dummyWallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });

    // Load IDL dynamically
    const idlModule = await import("@/lib/idl");
    const program = new Program(idlModule.AAP_IDL as any as Idl, provider);

    // Fetch agreement
    const agreementKey = new PublicKey(agreementPda);
    const agreement = await (program.account as any).agreement.fetch(agreementKey);

    // Fetch all parties
    const allParties = await (program.account as any).agreementParty.all([
      { memcmp: { offset: 8, bytes: agreementKey.toBase58() } },
    ]);

    // Fetch identity data for each party
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

    // Generate PDF
    const pdfBuffer = await generateSignedPDF(agreement, partiesWithIdentity, agreementPda);

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

async function generateSignedPDF(
  agreement: any,
  parties: { party: any; identity: any }[],
  pdaStr: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const typeLabel = AGREEMENT_TYPE_LABELS[agreement.agreementType] ?? "Agreement";
    const statusLabel = STATUS_LABELS[agreement.status] ?? "Unknown";
    const idHex = bytesToHex(Array.from(agreement.agreementId));
    const termsHash = bytesToHex(Array.from(agreement.termsHash));
    const termsUri = bytesToString(Array.from(agreement.termsUri));

    // ── Header ──
    doc.fontSize(9).fillColor("#888").text("AGENT AGREEMENT PROTOCOL", { align: "center" });
    doc.fontSize(8).fillColor("#aaa").text("On-chain Agreement Record — Solana Devnet", { align: "center" });
    doc.moveDown(0.8);

    // Title
    doc.fontSize(22).fillColor("#000").text(typeLabel.toUpperCase(), { align: "center" });
    doc.moveDown(0.3);

    // Status badge
    const statusColor = agreement.status === 1 ? "#16a34a" : agreement.status === 2 ? "#2563eb" : agreement.status === 0 ? "#ca8a04" : "#dc2626";
    doc.fontSize(11).fillColor(statusColor).text(`Status: ${statusLabel}`, { align: "center" });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.8);

    // ── Agreement Details ──
    doc.fontSize(12).fillColor("#000").text("AGREEMENT DETAILS", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#333");

    const details = [
      ["Agreement ID:", idHex],
      ["Agreement PDA:", pdaStr],
      ["Type:", typeLabel],
      ["Visibility:", agreement.visibility === 0 ? "Public" : "Private"],
      ["Created:", formatDate(agreement.createdAt.toNumber())],
      ["Expires:", agreement.expiresAt.toNumber() > 0 ? formatDate(agreement.expiresAt.toNumber()) : "No expiration"],
      ["Parties:", `${agreement.numSigned}/${agreement.numParties} signed`],
      ["Network:", "Solana Devnet"],
    ];

    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").text(label, { continued: true, width: 130 });
      doc.font("Helvetica").text(` ${value}`);
      doc.moveDown(0.2);
    }

    doc.moveDown(0.5);

    // ── Terms ──
    doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("TERMS", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#333").font("Helvetica");
    doc.text("Terms Hash (SHA-256):", { continued: false });
    doc.font("Courier").fontSize(8).fillColor("#555").text(termsHash);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#333").text("Terms URI:", { continued: false });
    doc.font("Courier").fontSize(8).fillColor("#555").text(termsUri || "None");
    doc.moveDown(1);

    // ── Escrow ──
    const escrowSol = agreement.escrowTotal.toNumber() / 1e9;
    if (escrowSol > 0) {
      doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("ESCROW", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#333").font("Helvetica");
      doc.text(`Total Escrowed: ${escrowSol.toFixed(4)} SOL`);
      doc.moveDown(1);
    }

    // ── Signatures ──
    doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("SIGNATURES", { underline: true });
    doc.moveDown(0.8);

    for (const { party, identity } of parties) {
      const p = party.account;
      const role = ROLE_LABELS[p.role] ?? "Party";
      const agentKey = identity?.agentKey?.toBase58() ?? p.agentIdentity.toBase58();
      const authority = identity?.authority?.toBase58() ?? "Unknown";
      const signed = p.signed;
      const signedAt = signed ? formatDate(p.signedAt.toNumber()) : null;

      // Signature box
      const boxY = doc.y;
      doc.roundedRect(55, boxY, 485, signed ? 80 : 60, 4).strokeColor(signed ? "#16a34a" : "#ddd").stroke();

      doc.fontSize(10).fillColor("#000").font("Helvetica-Bold");
      doc.text(role.toUpperCase(), 65, boxY + 10);

      doc.fontSize(8).fillColor("#555").font("Courier");
      doc.text(`Agent: ${agentKey}`, 65, boxY + 25);
      doc.text(`Authority: ${authority}`, 65, boxY + 37);

      if (signed && signedAt) {
        // Signature line with cursive-style name
        doc.fontSize(14).fillColor("#1a1a1a").font("Helvetica-Oblique");
        doc.text(shortenPubkey(agentKey, 12), 340, boxY + 10);

        doc.fontSize(8).fillColor("#16a34a").font("Helvetica-Bold");
        doc.text(`✓ SIGNED`, 340, boxY + 30);
        doc.font("Helvetica").fillColor("#888");
        doc.text(signedAt, 390, boxY + 30);

        // Party PDA
        doc.fontSize(7).fillColor("#aaa").font("Courier");
        doc.text(`Party PDA: ${party.publicKey.toBase58()}`, 65, boxY + 55);

        doc.y = boxY + 90;
      } else {
        doc.fontSize(10).fillColor("#ca8a04").font("Helvetica-Bold");
        doc.text("⏳ PENDING", 340, boxY + 25);

        doc.y = boxY + 70;
      }
    }

    // ── Footer ──
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.5);

    doc.fontSize(7).fillColor("#aaa").font("Helvetica");
    doc.text(
      "This document is a cryptographically verifiable record of an on-chain agreement on the Solana blockchain. " +
        "All signatures are Ed25519 digital signatures verified by the Agent Agreement Protocol smart contract. " +
        "The terms hash above can be used to verify the integrity of any attached documents.",
      50,
      doc.y,
      { width: 495, align: "center" }
    );
    doc.moveDown(0.5);
    doc.text(
      `Generated: ${new Date().toISOString()} | Program: ${PROGRAM_ID.toBase58()} | Verify at: https://frontend-ten-livid-87.vercel.app/agreement/${pdaStr}`,
      50,
      doc.y,
      { width: 495, align: "center" }
    );

    doc.end();
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST: Store agreement metadata (called after on-chain proposal)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agreementPda,
      agreementIdHex,
      visibility,
      documentKey,
      documentName,
      documentHash,
      termsText,
      parties, // Array of { walletPubkey, role }
      signerName, // Proposer's display name
      signerWallet, // Proposer's wallet
    } = body;

    if (!agreementPda || !agreementIdHex) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create agreement with parties
    const agreement = await prisma.agreement.create({
      data: {
        agreementPda,
        agreementIdHex,
        visibility: visibility ?? 0,
        documentKey,
        documentName,
        documentHash,
        termsText,
        parties: {
          create: (parties || []).map((p: { walletPubkey: string; role: string }) => ({
            walletPubkey: p.walletPubkey,
            role: p.role || "party",
          })),
        },
      },
      include: { parties: true },
    });

    // Upsert signer profile if name provided
    if (signerName && signerWallet) {
      await prisma.signerProfile.upsert({
        where: { walletPubkey: signerWallet },
        update: { displayName: signerName },
        create: { walletPubkey: signerWallet, displayName: signerName },
      });
    }

    return NextResponse.json(agreement);
  } catch (error: unknown) {
    console.error("Create agreement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create" },
      { status: 500 }
    );
  }
}

// GET: Fetch agreement metadata (checks access for private agreements)
export async function GET(request: NextRequest) {
  const pda = request.nextUrl.searchParams.get("pda");
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!pda) {
    return NextResponse.json({ error: "Missing pda parameter" }, { status: 400 });
  }

  try {
    const agreement = await prisma.agreement.findUnique({
      where: { agreementPda: pda },
      include: { parties: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Private agreement access check
    if (agreement.visibility === 1) {
      if (!wallet) {
        return NextResponse.json({ 
          id: agreement.id,
          agreementPda: agreement.agreementPda,
          visibility: 1,
          private: true,
          message: "This is a private agreement. Connect your wallet to view."
        });
      }

      const isParty = agreement.parties.some(
        (p) => p.walletPubkey === wallet
      );

      if (!isParty) {
        return NextResponse.json({
          id: agreement.id,
          agreementPda: agreement.agreementPda,
          visibility: 1,
          private: true,
          message: "You are not a party to this private agreement."
        });
      }
    }

    // Fetch signer profiles for all parties
    const wallets = agreement.parties.map((p) => p.walletPubkey);
    const profiles = await prisma.signerProfile.findMany({
      where: { walletPubkey: { in: wallets } },
    });

    return NextResponse.json({
      ...agreement,
      signerProfiles: profiles,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

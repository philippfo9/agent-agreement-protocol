import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: Fetch signer profile by wallet
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  }

  const profile = await prisma.signerProfile.findUnique({
    where: { walletPubkey: wallet },
  });

  return NextResponse.json(profile || { walletPubkey: wallet, displayName: null });
}

// POST: Create or update signer profile
export async function POST(request: NextRequest) {
  try {
    const { walletPubkey, displayName } = await request.json();

    if (!walletPubkey || !displayName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const profile = await prisma.signerProfile.upsert({
      where: { walletPubkey },
      update: { displayName },
      create: { walletPubkey, displayName },
    });

    return NextResponse.json(profile);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuthHeaders } from "@/lib/auth";

// GET: Fetch all agreements where authenticated wallet is a party
export async function GET(request: NextRequest) {
  const auth = verifyAuthHeaders({
    wallet: request.headers.get("x-wallet"),
    signature: request.headers.get("x-signature"),
    timestamp: request.headers.get("x-timestamp"),
  });

  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const agreements = await prisma.agreement.findMany({
      where: {
        parties: {
          some: { walletPubkey: auth.wallet },
        },
      },
      include: { parties: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(agreements);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

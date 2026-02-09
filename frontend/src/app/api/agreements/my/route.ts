import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: Fetch all agreements where wallet is a party
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  }

  try {
    const agreements = await prisma.agreement.findMany({
      where: {
        parties: {
          some: { walletPubkey: wallet },
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

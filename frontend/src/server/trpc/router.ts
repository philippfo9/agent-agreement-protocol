import { z } from "zod";
import { router, publicProcedure, authedProcedure } from "./index";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 client
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET || "aap";

export const appRouter = router({
  // ─── Agreements ───────────────────────────────────────────

  // Create agreement metadata (after on-chain proposal)
  createAgreement: authedProcedure
    .input(
      z.object({
        agreementPda: z.string(),
        agreementIdHex: z.string(),
        visibility: z.number().default(0),
        documentKey: z.string().optional(),
        documentName: z.string().optional(),
        documentHash: z.string().optional(),
        termsText: z.string().optional(),
        parties: z
          .array(z.object({ walletPubkey: z.string(), role: z.string().default("party") }))
          .default([]),
        signerName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agreement = await prisma.agreement.create({
        data: {
          agreementPda: input.agreementPda,
          agreementIdHex: input.agreementIdHex,
          visibility: input.visibility,
          documentKey: input.documentKey,
          documentName: input.documentName,
          documentHash: input.documentHash,
          termsText: input.termsText,
          parties: {
            create: input.parties.map((p) => ({
              walletPubkey: p.walletPubkey,
              role: p.role,
            })),
          },
        },
        include: { parties: true },
      });

      // Upsert signer profile
      if (input.signerName && ctx.wallet) {
        await prisma.signerProfile.upsert({
          where: { walletPubkey: ctx.wallet },
          update: { displayName: input.signerName },
          create: { walletPubkey: ctx.wallet, displayName: input.signerName },
        });
      }

      return agreement;
    }),

  // Get agreement metadata (with private access check)
  getAgreement: publicProcedure
    .input(z.object({ pda: z.string() }))
    .query(async ({ input, ctx }) => {
      const agreement = await prisma.agreement.findUnique({
        where: { agreementPda: input.pda },
        include: { parties: true },
      });

      if (!agreement) return null;

      // Private access gate
      if (agreement.visibility === 1) {
        if (!ctx.wallet) {
          return {
            id: agreement.id,
            agreementPda: agreement.agreementPda,
            visibility: 1 as const,
            private: true as const,
            message: "This is a private agreement. Sign with your wallet to view.",
          };
        }

        const isParty = agreement.parties.some((p) => p.walletPubkey === ctx.wallet);
        if (!isParty) {
          return {
            id: agreement.id,
            agreementPda: agreement.agreementPda,
            visibility: 1 as const,
            private: true as const,
            message: "You are not a party to this private agreement.",
          };
        }
      }

      // Fetch signer profiles
      const wallets = agreement.parties.map((p) => p.walletPubkey);
      const signerProfiles = await prisma.signerProfile.findMany({
        where: { walletPubkey: { in: wallets } },
      });

      return { ...agreement, signerProfiles };
    }),

  // My agreements (authenticated)
  myAgreements: authedProcedure.query(async ({ ctx }) => {
    return prisma.agreement.findMany({
      where: {
        parties: { some: { walletPubkey: ctx.wallet } },
      },
      include: { parties: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ─── Profiles ─────────────────────────────────────────────

  getProfile: publicProcedure
    .input(z.object({ wallet: z.string() }))
    .query(async ({ input }) => {
      const profile = await prisma.signerProfile.findUnique({
        where: { walletPubkey: input.wallet },
      });
      return profile || { walletPubkey: input.wallet, displayName: null };
    }),

  updateProfile: authedProcedure
    .input(z.object({ displayName: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      return prisma.signerProfile.upsert({
        where: { walletPubkey: ctx.wallet },
        update: { displayName: input.displayName },
        create: { walletPubkey: ctx.wallet, displayName: input.displayName },
      });
    }),

  // ─── Documents ────────────────────────────────────────────

  getDocumentUrl: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: input.key }),
        { expiresIn: 7 * 24 * 60 * 60 }
      );
      return { url };
    }),
});

export type AppRouter = typeof appRouter;

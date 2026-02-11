import { z } from "zod";
import { router, publicProcedure, authedProcedure } from "./index";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "@/lib/idl";
import { getAgentIdentityPDA } from "@/lib/pda";

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

  // ─── Agent Policy ──────────────────────────────────────────

  getPolicy: publicProcedure
    .input(z.object({ agentPubkey: z.string() }))
    .query(async ({ input }) => {
      return prisma.agentPolicy.findUnique({
        where: { agentPubkey: input.agentPubkey },
      });
    }),

  setPolicy: authedProcedure
    .input(
      z.object({
        agentPubkey: z.string(),
        allowedTypes: z.array(z.string()),
        maxEscrowLamports: z.union([z.bigint(), z.number(), z.null()]).optional(),
        maxActiveAgreements: z.number().int().positive().nullable().optional(),
        requireHumanCosign: z.boolean(),
        maxDurationDays: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify wallet is the authority for this agent on-chain
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const provider = new AnchorProvider(
        connection,
        { publicKey: PublicKey.default, signAllTransactions: async (txs: any) => txs, signTransaction: async (tx: any) => tx } as any,
        { commitment: "confirmed" }
      );
      const program = new Program(AAP_IDL as any as Idl, provider);

      const agentKey = new PublicKey(input.agentPubkey);
      const [pda] = getAgentIdentityPDA(agentKey);

      let identity;
      try {
        identity = await (program.account as any).agentIdentity.fetch(pda);
      } catch {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found on-chain" });
      }

      if (identity.authority.toBase58() !== ctx.wallet) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the agent authority can set policy" });
      }

      const escrow = input.maxEscrowLamports != null ? BigInt(input.maxEscrowLamports) : null;

      return prisma.agentPolicy.upsert({
        where: { agentPubkey: input.agentPubkey },
        update: {
          authorityWallet: ctx.wallet,
          allowedTypes: input.allowedTypes,
          maxEscrowLamports: escrow,
          maxActiveAgreements: input.maxActiveAgreements ?? null,
          requireHumanCosign: input.requireHumanCosign,
          maxDurationDays: input.maxDurationDays ?? null,
        },
        create: {
          agentPubkey: input.agentPubkey,
          authorityWallet: ctx.wallet,
          allowedTypes: input.allowedTypes,
          maxEscrowLamports: escrow,
          maxActiveAgreements: input.maxActiveAgreements ?? null,
          requireHumanCosign: input.requireHumanCosign,
          maxDurationDays: input.maxDurationDays ?? null,
        },
      });
    }),

  checkPolicy: publicProcedure
    .input(
      z.object({
        agentPubkey: z.string(),
        agreementType: z.string(),
        escrowAmount: z.union([z.bigint(), z.number(), z.null()]).optional(),
        durationDays: z.number().nullable().optional(),
      })
    )
    .query(async ({ input }) => {
      const policy = await prisma.agentPolicy.findUnique({
        where: { agentPubkey: input.agentPubkey },
      });

      if (!policy) {
        return { allowed: true, requiresCosign: false, violations: [] };
      }

      const violations: string[] = [];

      if (policy.allowedTypes.length > 0 && !policy.allowedTypes.includes(input.agreementType)) {
        violations.push(`Agreement type "${input.agreementType}" is not allowed. Allowed: ${policy.allowedTypes.join(", ")}`);
      }

      if (policy.maxEscrowLamports != null && input.escrowAmount != null) {
        if (BigInt(input.escrowAmount) > policy.maxEscrowLamports) {
          violations.push(`Escrow amount exceeds maximum of ${policy.maxEscrowLamports.toString()} lamports`);
        }
      }

      if (policy.maxDurationDays != null && input.durationDays != null) {
        if (input.durationDays > policy.maxDurationDays) {
          violations.push(`Duration ${input.durationDays} days exceeds maximum of ${policy.maxDurationDays} days`);
        }
      }

      return {
        allowed: violations.length === 0,
        requiresCosign: policy.requireHumanCosign,
        violations,
      };
    }),

  // ─── Draft Agreements ─────────────────────────────────────

  listDrafts: authedProcedure.query(async ({ ctx }) => {
    return prisma.draftAgreement.findMany({
      where: { authorityWallet: ctx.wallet },
      orderBy: { createdAt: "desc" },
    });
  }),

  createDraft: authedProcedure
    .input(
      z.object({
        agentPubkey: z.string(),
        agreementType: z.string(),
        counterpartyPubkey: z.string().nullable().optional(),
        termsHash: z.string(),
        termsUri: z.string().nullable().optional(),
        isPublic: z.boolean().default(true),
        escrowAmount: z.union([z.bigint(), z.number(), z.null()]).optional(),
        durationDays: z.number().nullable().optional(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Look up the policy to get authorityWallet
      const policy = await prisma.agentPolicy.findUnique({
        where: { agentPubkey: input.agentPubkey },
      });

      if (!policy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No policy found for this agent" });
      }

      if (!policy.requireHumanCosign) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Agent does not require human cosign" });
      }

      return prisma.draftAgreement.create({
        data: {
          agentPubkey: input.agentPubkey,
          authorityWallet: policy.authorityWallet,
          agreementType: input.agreementType,
          counterpartyPubkey: input.counterpartyPubkey ?? null,
          termsHash: input.termsHash,
          termsUri: input.termsUri ?? null,
          isPublic: input.isPublic,
          escrowAmount: input.escrowAmount != null ? BigInt(input.escrowAmount) : null,
          durationDays: input.durationDays ?? null,
          title: input.title ?? null,
          description: input.description ?? null,
        },
      });
    }),

  approveDraft: authedProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const draft = await prisma.draftAgreement.findUnique({ where: { id: input.draftId } });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      if (draft.authorityWallet !== ctx.wallet) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the authority can approve drafts" });
      }
      if (draft.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Draft is not pending" });
      }
      return prisma.draftAgreement.update({
        where: { id: input.draftId },
        data: { status: "approved" },
      });
    }),

  rejectDraft: authedProcedure
    .input(z.object({ draftId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const draft = await prisma.draftAgreement.findUnique({ where: { id: input.draftId } });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      if (draft.authorityWallet !== ctx.wallet) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the authority can reject drafts" });
      }
      if (draft.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Draft is not pending" });
      }
      return prisma.draftAgreement.update({
        where: { id: input.draftId },
        data: { status: "rejected", rejectionReason: input.reason ?? null },
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

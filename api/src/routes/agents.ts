import { Router } from "express";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { findAgentIdentityPDA, findAgreementPartyPDA } from "../program";

const STATUS_LABELS: Record<number, string> = {
  0: "proposed", 1: "active", 2: "fulfilled", 3: "breached", 4: "disputed", 5: "cancelled",
};

const ROLE_LABELS: Record<number, string> = {
  0: "proposer", 1: "counterparty", 2: "witness", 3: "arbitrator",
};

function serializeAccount(acc: any): any {
  const obj: any = {};
  for (const [k, v] of Object.entries(acc)) {
    if (v instanceof PublicKey) {
      obj[k] = v.toString();
    } else if (v && typeof v === "object" && "toNumber" in (v as any)) {
      obj[k] = (v as any).toString();
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "number") {
      obj[k] = Buffer.from(v as number[]).toString("hex");
    } else if (v && typeof v === "object") {
      obj[k] = serializeAccount(v);
    } else {
      obj[k] = v;
    }
  }
  return obj;
}

export function agentRoutes(program: Program, connection: Connection): Router {
  const router = Router();

  // GET /agents — list all agents (with pagination)
  router.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const allAccounts = await (program.account as any).agentIdentity.all();
      const total = allAccounts.length;
      const page = allAccounts.slice(offset, offset + limit);
      res.json({
        agents: page.map((a: any) => ({
          pda: a.publicKey.toString(),
          ...serializeAccount(a.account),
        })),
        total,
        limit,
        offset,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /agents/:pubkey — get agent identity by agent pubkey or PDA
  router.get("/:pubkey", async (req, res) => {
    try {
      const key = new PublicKey(req.params.pubkey);
      // Try as agent_key first (derive PDA), then as direct PDA
      const [pda] = findAgentIdentityPDA(key);
      let account: any;
      try {
        account = await (program.account as any).agentIdentity.fetch(pda);
      } catch {
        // Maybe they passed the PDA directly
        try {
          account = await (program.account as any).agentIdentity.fetch(key);
        } catch {
          return res.status(404).json({ error: "Agent not found" });
        }
      }
      res.json({
        pda: pda.toString(),
        ...serializeAccount(account),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /agents/:pubkey/agreements — list agreements for an agent
  router.get("/:pubkey/agreements", async (req, res) => {
    try {
      const key = new PublicKey(req.params.pubkey);
      const [identityPDA] = findAgentIdentityPDA(key);

      // Find all AgreementParty records for this agent
      const parties = await (program.account as any).agreementParty.all([
        {
          memcmp: {
            offset: 8 + 32, // discriminator + agreement pubkey = agentIdentity field
            bytes: identityPDA.toBase58(),
          },
        },
      ]);

      const agreements = [];
      for (const p of parties) {
        try {
          const agreement = await (program.account as any).agreement.fetch(
            p.account.agreement
          );
          agreements.push({
            agreementPDA: p.account.agreement.toString(),
            partyPDA: p.publicKey.toString(),
            role: ROLE_LABELS[p.account.role] || p.account.role,
            signed: p.account.signed,
            signedAt: p.account.signedAt?.toString(),
            agreement: serializeAccount(agreement),
          });
        } catch {
          // Agreement may have been closed
        }
      }
      res.json({ agreements });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /agents/:pubkey/stats — agent stats
  router.get("/:pubkey/stats", async (req, res) => {
    try {
      const key = new PublicKey(req.params.pubkey);
      const [identityPDA] = findAgentIdentityPDA(key);

      const parties = await (program.account as any).agreementParty.all([
        {
          memcmp: {
            offset: 8 + 32,
            bytes: identityPDA.toBase58(),
          },
        },
      ]);

      let totalAgreements = 0;
      let fulfilledCount = 0;
      let activeCount = 0;
      let escrowVolume = BigInt(0);

      for (const p of parties) {
        totalAgreements++;
        escrowVolume += BigInt(p.account.escrowDeposited?.toString() || "0");
        try {
          const agr = await (program.account as any).agreement.fetch(p.account.agreement);
          if (agr.status === 2) fulfilledCount++;
          if (agr.status === 1) activeCount++;
        } catch {}
      }

      res.json({
        agentKey: key.toString(),
        identityPDA: identityPDA.toString(),
        totalAgreements,
        activeCount,
        fulfilledCount,
        escrowVolume: escrowVolume.toString(),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /agents/register — build register_agent transaction
  router.post("/register", async (req, res) => {
    try {
      const { authority, agentKey, metadataHash, scope } = req.body;
      if (!authority || !agentKey) {
        return res.status(400).json({ error: "authority and agentKey required" });
      }

      const authorityPk = new PublicKey(authority);
      const agentKeyPk = new PublicKey(agentKey);
      const [agentIdentityPDA] = findAgentIdentityPDA(agentKeyPk);

      const metaHash = metadataHash
        ? Array.from(Buffer.from(metadataHash, "hex"))
        : new Array(32).fill(0);

      const scopeArg = {
        canSignAgreements: scope?.canSignAgreements ?? true,
        canCommitFunds: scope?.canCommitFunds ?? false,
        maxCommitLamports: scope?.maxCommitLamports ? new (require("@coral-xyz/anchor").BN)(scope.maxCommitLamports) : new (require("@coral-xyz/anchor").BN)(0),
        expiresAt: scope?.expiresAt ? new (require("@coral-xyz/anchor").BN)(scope.expiresAt) : new (require("@coral-xyz/anchor").BN)(0),
      };

      const tx = await program.methods
        .registerAgent(agentKeyPk, metaHash, scopeArg)
        .accounts({
          authority: authorityPk,
          agentIdentity: agentIdentityPDA,
          systemProgram: PublicKey.default,
        } as any)
        .transaction();

      tx.feePayer = authorityPk;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

      res.json({
        transaction: serialized,
        agentIdentityPDA: agentIdentityPDA.toString(),
        message: "Sign this transaction with the authority wallet and submit to Solana",
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

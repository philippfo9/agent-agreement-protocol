/**
 * seed-demo.ts — Fresh demo data for video recording
 * 
 * Creates realistic-looking agents + agreements with proper names and scenarios.
 * Run: npx ts-node --transpile-only scripts/seed-demo.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Connection, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const HELIUS_RPC = "https://devnet.helius-rpc.com?api-key=0a24352c-be73-4d0e-9777-38bfde485853";
const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");

const idlPath = path.join(__dirname, "..", "idl", "agent_agreement_protocol.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

const walletPath = "/root/.config/solana/id.json";
const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));

function getAgentPDA(agentKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("agent"), agentKey.toBuffer()], PROGRAM_ID);
}
function getAgreementPDA(agreementId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("agreement"), Buffer.from(agreementId)], PROGRAM_ID);
}
function getPartyPDA(agreementId: number[], identityPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("party"), Buffer.from(agreementId), identityPDA.toBuffer()], PROGRAM_ID);
}
function getVaultPDA(agentPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), agentPDA.toBuffer()], PROGRAM_ID);
}
function randomAgreementId(): number[] {
  return Array.from(crypto.randomBytes(16));
}
function termsHash(text: string): number[] {
  const h = crypto.createHash("sha256").update(text).digest();
  return Array.from(h);
}
function termsUri(uri: string): number[] {
  const buf = new Array(64).fill(0);
  Buffer.from(uri).copy(Buffer.from(buf), 0);
  return buf;
}
function metaHash(name: string): number[] {
  const h = crypto.createHash("sha256").update(name).digest();
  return Array.from(h);
}

async function main() {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const wallet = new anchor.Wallet(deployer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   AAP Demo Seeder                                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Deployer: ${deployer.publicKey.toBase58()}`);
  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // ── Agents ──────────────────────────────────────────────────────────
  const agents = [
    { key: Keypair.generate(), name: "Devin (AI Dev Agent)", canSign: true, canCommit: true, maxCommit: 50 },
    { key: Keypair.generate(), name: "Sierra (Customer Support)", canSign: true, canCommit: false, maxCommit: 0 },
    { key: Keypair.generate(), name: "Aria (Trading Bot)", canSign: true, canCommit: true, maxCommit: 100 },
    { key: Keypair.generate(), name: "Atlas (Research Agent)", canSign: true, canCommit: true, maxCommit: 25 },
  ];

  const agentPDAs: PublicKey[] = [];

  for (const agent of agents) {
    const [pda] = getAgentPDA(agent.key.publicKey);
    agentPDAs.push(pda);
    const scope = {
      canSignAgreements: agent.canSign,
      canCommitFunds: agent.canCommit,
      maxCommitLamports: new BN(agent.maxCommit * 1e9),
      expiresAt: new BN(Math.floor(Date.now() / 1000) + 365 * 86400),
    };

    try {
      const prog = new Program(idl as Idl, provider);
      await (prog.methods as any)
        .registerAgent(agent.key.publicKey, metaHash(agent.name), scope)
        .accounts({
          authority: deployer.publicKey,
          agentIdentity: pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`✅ Registered "${agent.name}"`);
      console.log(`   Agent key: ${agent.key.publicKey.toBase58()}`);
      console.log(`   PDA: ${pda.toBase58()}`);
    } catch (e: any) {
      console.log(`❌ Failed "${agent.name}": ${e.message?.slice(0, 120)}`);
    }
  }

  // Fund agent keypairs
  const fundTx = new Transaction();
  for (const agent of agents) {
    fundTx.add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: agent.key.publicKey, lamports: 50_000_000 }));
  }
  await provider.sendAndConfirm(fundTx);
  console.log(`\n💰 Funded 4 agent wallets (0.05 SOL each)\n`);

  function agentProgram(key: Keypair) {
    return new Program(idl as Idl, new AnchorProvider(connection, new anchor.Wallet(key), { commitment: "confirmed" }));
  }

  // ── Deposit to Vault (Devin) ────────────────────────────────────────
  console.log("─── Vault Deposit ───");
  try {
    const [devinPDA] = getAgentPDA(agents[0].key.publicKey);
    const [vaultPDA] = getVaultPDA(devinPDA);
    const prog = new Program(idl as Idl, provider);
    await (prog.methods as any)
      .depositToVault(new BN(0.5 * 1e9))
      .accounts({
        authority: deployer.publicKey,
        agentIdentity: devinPDA,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`✅ Deposited 0.5 SOL to Devin's vault`);
  } catch (e: any) {
    console.log(`❌ Vault deposit failed: ${e.message?.slice(0, 120)}`);
  }

  // ── Agreement 1: NDA (Active) ───────────────────────────────────────
  console.log("\n─── Agreement 1: NDA (Devin ↔ Sierra) ───");
  const agrId1 = randomAgreementId();
  try {
    const [agrPda] = getAgreementPDA(agrId1);
    const [proposerParty] = getPartyPDA(agrId1, agentPDAs[0]);
    const prog1 = agentProgram(agents[0].key);

    await (prog1.methods as any)
      .proposeAgreement(agrId1, 4, 0,
        termsHash("Mutual NDA — All shared technical documentation, API keys, and agent configurations are strictly confidential. Breach triggers automatic agreement termination and on-chain dispute record."),
        termsUri("ar://NDA-devin-sierra-2026"),
        2, new BN(Math.floor(Date.now() / 1000) + 365 * 86400))
      .accounts({ proposerSigner: agents[0].key.publicKey, proposerIdentity: agentPDAs[0], agreement: agrPda, proposerParty, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`  ✅ Proposed: ${agrPda.toBase58()}`);

    const [cpParty] = getPartyPDA(agrId1, agentPDAs[1]);
    await (prog1.methods as any)
      .addParty(agrId1, 1)
      .accounts({ proposerSigner: agents[0].key.publicKey, proposerIdentity: agentPDAs[0], agreement: agrPda, partyIdentity: agentPDAs[1], party: cpParty, systemProgram: SystemProgram.programId })
      .rpc();

    const prog2 = agentProgram(agents[1].key);
    await (prog2.methods as any)
      .signAgreement(agrId1)
      .accounts({ signer: agents[1].key.publicKey, signerIdentity: agentPDAs[1], agreement: agrPda, party: cpParty })
      .rpc();
    console.log(`  ✅ Both signed → ACTIVE`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 150)}`);
  }

  // ── Agreement 2: Service Contract (Active) ──────────────────────────
  console.log("\n─── Agreement 2: Service Contract (Devin ↔ Atlas) ───");
  const agrId2 = randomAgreementId();
  try {
    const [agrPda] = getAgreementPDA(agrId2);
    const [proposerParty] = getPartyPDA(agrId2, agentPDAs[0]);
    const prog1 = agentProgram(agents[0].key);

    await (prog1.methods as any)
      .proposeAgreement(agrId2, 1, 0,
        termsHash("Devin provides full-stack development services for Atlas Research Platform. Deliverables: REST API, React dashboard, deployment pipeline. Payment: 10 SOL upon completion. Timeline: 30 days."),
        termsUri("ar://service-devin-atlas-2026"),
        2, new BN(Math.floor(Date.now() / 1000) + 90 * 86400))
      .accounts({ proposerSigner: agents[0].key.publicKey, proposerIdentity: agentPDAs[0], agreement: agrPda, proposerParty, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`  ✅ Proposed: ${agrPda.toBase58()}`);

    const [cpParty] = getPartyPDA(agrId2, agentPDAs[3]);
    await (prog1.methods as any)
      .addParty(agrId2, 1)
      .accounts({ proposerSigner: agents[0].key.publicKey, proposerIdentity: agentPDAs[0], agreement: agrPda, partyIdentity: agentPDAs[3], party: cpParty, systemProgram: SystemProgram.programId })
      .rpc();

    const prog4 = agentProgram(agents[3].key);
    await (prog4.methods as any)
      .signAgreement(agrId2)
      .accounts({ signer: agents[3].key.publicKey, signerIdentity: agentPDAs[3], agreement: agrPda, party: cpParty })
      .rpc();
    console.log(`  ✅ Both signed → ACTIVE`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 150)}`);
  }

  // ── Agreement 3: Revenue Share (Fulfilled) ──────────────────────────
  console.log("\n─── Agreement 3: Revenue Share (Aria ↔ Atlas) — Fulfilled ───");
  const agrId3 = randomAgreementId();
  try {
    const [agrPda] = getAgreementPDA(agrId3);
    const [proposerParty] = getPartyPDA(agrId3, agentPDAs[2]);
    const prog3 = agentProgram(agents[2].key);

    await (prog3.methods as any)
      .proposeAgreement(agrId3, 2, 0,
        termsHash("Revenue share: Aria Trading Bot generates alpha, Atlas provides research signals. Split: 60% Aria / 40% Atlas. Monthly settlement. Minimum 3-month commitment."),
        termsUri("ar://revshare-aria-atlas-2026"),
        2, new BN(Math.floor(Date.now() / 1000) + 180 * 86400))
      .accounts({ proposerSigner: agents[2].key.publicKey, proposerIdentity: agentPDAs[2], agreement: agrPda, proposerParty, systemProgram: SystemProgram.programId })
      .rpc();

    const [cpParty] = getPartyPDA(agrId3, agentPDAs[3]);
    await (prog3.methods as any)
      .addParty(agrId3, 1)
      .accounts({ proposerSigner: agents[2].key.publicKey, proposerIdentity: agentPDAs[2], agreement: agrPda, partyIdentity: agentPDAs[3], party: cpParty, systemProgram: SystemProgram.programId })
      .rpc();

    const prog4 = agentProgram(agents[3].key);
    await (prog4.methods as any)
      .signAgreement(agrId3)
      .accounts({ signer: agents[3].key.publicKey, signerIdentity: agentPDAs[3], agreement: agrPda, party: cpParty })
      .rpc();

    // Fulfill
    await (prog3.methods as any)
      .fulfillAgreement(agrId3)
      .accounts({ signer: agents[2].key.publicKey, signerIdentity: agentPDAs[2], signerParty: proposerParty, agreement: agrPda })
      .rpc();
    console.log(`  ✅ Proposed → Signed → FULFILLED`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 150)}`);
  }

  // ── Agreement 4: Freelance (Pending — awaiting signature) ───────────
  console.log("\n─── Agreement 4: Freelance Contract (Sierra → Devin) — Pending ───");
  const agrId4 = randomAgreementId();
  try {
    const [agrPda] = getAgreementPDA(agrId4);
    const [proposerParty] = getPartyPDA(agrId4, agentPDAs[1]);
    const prog2 = agentProgram(agents[1].key);

    await (prog2.methods as any)
      .proposeAgreement(agrId4, 1, 0,
        termsHash("Sierra requests Devin build a customer feedback analysis pipeline. Scope: sentiment analysis, ticket categorization, weekly reports. 5 SOL fixed price. 2 revision rounds included."),
        termsUri("ar://freelance-sierra-devin-2026"),
        2, new BN(Math.floor(Date.now() / 1000) + 30 * 86400))
      .accounts({ proposerSigner: agents[1].key.publicKey, proposerIdentity: agentPDAs[1], agreement: agrPda, proposerParty, systemProgram: SystemProgram.programId })
      .rpc();

    const [cpParty] = getPartyPDA(agrId4, agentPDAs[0]);
    await (prog2.methods as any)
      .addParty(agrId4, 1)
      .accounts({ proposerSigner: agents[1].key.publicKey, proposerIdentity: agentPDAs[1], agreement: agrPda, partyIdentity: agentPDAs[0], party: cpParty, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`  ✅ Proposed + party added — awaiting Devin's signature`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 150)}`);
  }

  // ── Agreement 5: Private NDA (Aria ↔ Devin) ────────────────────────
  console.log("\n─── Agreement 5: Private Agreement (Aria ↔ Devin) ───");
  const agrId5 = randomAgreementId();
  try {
    const [agrPda] = getAgreementPDA(agrId5);
    const [proposerParty] = getPartyPDA(agrId5, agentPDAs[2]);
    const prog3 = agentProgram(agents[2].key);

    await (prog3.methods as any)
      .proposeAgreement(agrId5, 4, 1, // PRIVATE visibility
        termsHash("Confidential trading strategy partnership. Details restricted to signatories only."),
        termsUri("ar://private-aria-devin-2026"),
        2, new BN(Math.floor(Date.now() / 1000) + 365 * 86400))
      .accounts({ proposerSigner: agents[2].key.publicKey, proposerIdentity: agentPDAs[2], agreement: agrPda, proposerParty, systemProgram: SystemProgram.programId })
      .rpc();

    const [cpParty] = getPartyPDA(agrId5, agentPDAs[0]);
    await (prog3.methods as any)
      .addParty(agrId5, 1)
      .accounts({ proposerSigner: agents[2].key.publicKey, proposerIdentity: agentPDAs[2], agreement: agrPda, partyIdentity: agentPDAs[0], party: cpParty, systemProgram: SystemProgram.programId })
      .rpc();

    const prog1 = agentProgram(agents[0].key);
    await (prog1.methods as any)
      .signAgreement(agrId5)
      .accounts({ signer: agents[0].key.publicKey, signerIdentity: agentPDAs[0], agreement: agrPda, party: cpParty })
      .rpc();
    console.log(`  ✅ Private agreement — ACTIVE (hidden from explore)`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 150)}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const finalBalance = await connection.getBalance(deployer.publicKey);
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Demo Data Summary                                     ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  4 Agents: Devin, Sierra, Aria, Atlas                   ║");
  console.log("║  5 Agreements:                                          ║");
  console.log("║    1. NDA (Devin↔Sierra) — Active                      ║");
  console.log("║    2. Service (Devin↔Atlas) — Active                   ║");
  console.log("║    3. RevShare (Aria↔Atlas) — Fulfilled                ║");
  console.log("║    4. Freelance (Sierra→Devin) — Pending               ║");
  console.log("║    5. Private (Aria↔Devin) — Active (hidden)           ║");
  console.log("║  1 Vault: Devin — 0.5 SOL deposited                    ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Cost: ${((balance - finalBalance) / 1e9).toFixed(4)} SOL`);
  console.log(`║  Remaining: ${(finalBalance / 1e9).toFixed(4)} SOL`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  console.log("\nAgent Keys:");
  agents.forEach((a, i) => console.log(`  ${a.name}: ${a.key.publicKey.toBase58()}`));
}

main().catch(console.error);

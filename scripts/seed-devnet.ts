import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");

// Load IDL
const idlPath = path.join(__dirname, "..", "idl", "agent_agreement_protocol.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// Load deployer wallet
const walletPath = "/root/.config/solana/id.json";
const secret = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
const deployer = Keypair.fromSecretKey(Uint8Array.from(secret));

function getAgentPDA(agentKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentKey.toBuffer()],
    PROGRAM_ID
  );
}

function getAgreementPDA(agreementId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    PROGRAM_ID
  );
}

function getPartyPDA(agreementId: number[], identityPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("party"), Buffer.from(agreementId), identityPDA.toBuffer()],
    PROGRAM_ID
  );
}

function randomAgreementId(): number[] {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const wallet = new anchor.Wallet(deployer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program(idl as Idl, provider);

  console.log("Deployer:", deployer.publicKey.toBase58());
  const balance = await connection.getBalance(deployer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  // === Register 3 agents ===
  const agent1Key = Keypair.generate();
  const agent2Key = Keypair.generate();
  const agent3Key = Keypair.generate();

  const agents = [
    { key: agent1Key, name: "Trading Agent Alpha", canSign: true, canCommit: true, maxCommit: 10 },
    { key: agent2Key, name: "Analytics Agent Beta", canSign: true, canCommit: false, maxCommit: 0 },
    { key: agent3Key, name: "Governance Agent Gamma", canSign: true, canCommit: true, maxCommit: 5 },
  ];

  for (const agent of agents) {
    const [pda] = getAgentPDA(agent.key.publicKey);
    const metadataHash = new Array(32).fill(0);
    // Put a simple hash based on name
    const nameBytes = Buffer.from(agent.name);
    for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
      metadataHash[i] = nameBytes[i];
    }

    const scope = {
      canSignAgreements: agent.canSign,
      canCommitFunds: agent.canCommit,
      maxCommitLamports: new BN(agent.maxCommit * 1e9),
      expiresAt: new BN(Math.floor(Date.now() / 1000) + 365 * 86400), // 1 year
    };

    try {
      await (program.methods as any)
        .registerAgent(agent.key.publicKey, metadataHash, scope)
        .accounts({
          authority: deployer.publicKey,
          agentIdentity: pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`✅ Registered "${agent.name}" → ${agent.key.publicKey.toBase58()}`);
      console.log(`   PDA: ${pda.toBase58()}`);
    } catch (e: any) {
      console.log(`❌ Failed "${agent.name}": ${e.message?.slice(0, 100)}`);
    }
  }

  // === Fund agent keypairs so they can sign txns ===
  const [agent1PDA] = getAgentPDA(agent1Key.publicKey);
  const [agent2PDA] = getAgentPDA(agent2Key.publicKey);
  const [agent3PDA] = getAgentPDA(agent3Key.publicKey);

  const fundAmount = 0.05 * 1e9; // 0.05 SOL each
  for (const k of [agent1Key, agent2Key, agent3Key]) {
    const tx = new (await import("@solana/web3.js")).Transaction().add(
      SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: k.publicKey, lamports: fundAmount })
    );
    await provider.sendAndConfirm(tx);
  }
  console.log(`\nFunded 3 agent wallets with 0.05 SOL each`);

  // Helper to get provider for an agent keypair
  function agentProvider(key: Keypair) {
    const w = new anchor.Wallet(key);
    return new AnchorProvider(connection, w, { commitment: "confirmed" });
  }
  function agentProgram(key: Keypair) {
    return new Program(idl as Idl, agentProvider(key));
  }

  // === Create agreements ===
  
  // Agreement 1: Service contract between Agent 1 and Agent 2
  const agrId1 = randomAgreementId();
  const [agrPda1] = getAgreementPDA(agrId1);
  const [proposerParty1] = getPartyPDA(agrId1, agent1PDA);

  try {
    const termsHash = new Array(32).fill(0);
    Buffer.from("Market analysis service contract").copy(Buffer.from(termsHash), 0);
    
    const termsUri = new Array(64).fill(0);
    Buffer.from("ipfs://QmServiceContract001").copy(Buffer.from(termsUri), 0);

    const prog1 = agentProgram(agent1Key);
    await (prog1.methods as any)
      .proposeAgreement(
        agrId1,
        1, // SERVICE type
        0, // PUBLIC visibility
        termsHash,
        termsUri,
        2, // num_parties
        new BN(Math.floor(Date.now() / 1000) + 90 * 86400)
      )
      .accounts({
        proposerSigner: agent1Key.publicKey,
        proposerIdentity: agent1PDA,
        agreement: agrPda1,
        proposerParty: proposerParty1,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`\n✅ Proposed Agreement 1 (Service): ${agrPda1.toBase58()}`);

    // Add Agent 2 as counterparty
    const [party2_agr1] = getPartyPDA(agrId1, agent2PDA);
    await (prog1.methods as any)
      .addParty(agrId1, 1)
      .accounts({
        proposerSigner: agent1Key.publicKey,
        proposerIdentity: agent1PDA,
        agreement: agrPda1,
        partyIdentity: agent2PDA,
        party: party2_agr1,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   Added Agent 2 as counterparty`);

    // Agent 2 signs → ACTIVE (proposer auto-signed on propose)
    const prog2 = agentProgram(agent2Key);
    await (prog2.methods as any)
      .signAgreement(agrId1)
      .accounts({
        signer: agent2Key.publicKey,
        signerIdentity: agent2PDA,
        agreement: agrPda1,
        party: party2_agr1,
      })
      .rpc();
    console.log(`   Agent 2 signed → Agreement ACTIVE ✅`);
  } catch (e: any) {
    console.log(`❌ Agreement 1 failed: ${e.message?.slice(0, 200)}`);
  }

  // Agreement 2: Partnership between Agent 1 and Agent 3
  const agrId2 = randomAgreementId();
  const [agrPda2] = getAgreementPDA(agrId2);
  const [proposerParty2] = getPartyPDA(agrId2, agent1PDA);

  try {
    const termsHash2 = new Array(32).fill(0);
    Buffer.from("Revenue share partnership 60-40").copy(Buffer.from(termsHash2), 0);

    const termsUri2 = new Array(64).fill(0);
    Buffer.from("ipfs://QmPartnership002").copy(Buffer.from(termsUri2), 0);

    const prog1 = agentProgram(agent1Key);
    await (prog1.methods as any)
      .proposeAgreement(
        agrId2,
        2, // PARTNERSHIP type
        0, // PUBLIC
        termsHash2,
        termsUri2,
        2,
        new BN(Math.floor(Date.now() / 1000) + 180 * 86400)
      )
      .accounts({
        proposerSigner: agent1Key.publicKey,
        proposerIdentity: agent1PDA,
        agreement: agrPda2,
        proposerParty: proposerParty2,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`\n✅ Proposed Agreement 2 (Partnership): ${agrPda2.toBase58()}`);

    // Add Agent 3
    const [party3_agr2] = getPartyPDA(agrId2, agent3PDA);
    await (prog1.methods as any)
      .addParty(agrId2, 1)
      .accounts({
        proposerSigner: agent1Key.publicKey,
        proposerIdentity: agent1PDA,
        agreement: agrPda2,
        partyIdentity: agent3PDA,
        party: party3_agr2,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   Added Agent 3 as counterparty`);

    // Agent 3 signs (proposer auto-signed)
    const prog3 = agentProgram(agent3Key);
    await (prog3.methods as any)
      .signAgreement(agrId2)
      .accounts({
        signer: agent3Key.publicKey,
        signerIdentity: agent3PDA,
        agreement: agrPda2,
        party: party3_agr2,
      })
      .rpc();
    console.log(`   Both signed → Agreement ACTIVE ✅`);

    // Fulfill
    await (prog1.methods as any)
      .fulfillAgreement(agrId2)
      .accounts({
        signer: agent1Key.publicKey,
        signerIdentity: agent1PDA,
        signerParty: proposerParty2,
        agreement: agrPda2,
      })
      .rpc();
    console.log(`   Agent 1 marked FULFILLED ✅`);
  } catch (e: any) {
    console.log(`❌ Agreement 2 failed: ${e.message?.slice(0, 200)}`);
  }

  // Agreement 3: Proposed but not yet signed (pending)
  const agrId3 = randomAgreementId();
  const [agrPda3] = getAgreementPDA(agrId3);
  const [proposerParty3] = getPartyPDA(agrId3, agent3PDA);

  try {
    const termsHash3 = new Array(32).fill(0);
    Buffer.from("Data sharing agreement - pending").copy(Buffer.from(termsHash3), 0);

    const termsUri3 = new Array(64).fill(0);
    Buffer.from("ipfs://QmDataSharing003").copy(Buffer.from(termsUri3), 0);

    const prog3 = agentProgram(agent3Key);
    await (prog3.methods as any)
      .proposeAgreement(
        agrId3,
        1, // SERVICE
        0, // PUBLIC
        termsHash3,
        termsUri3,
        2,
        new BN(Math.floor(Date.now() / 1000) + 30 * 86400)
      )
      .accounts({
        proposerSigner: agent3Key.publicKey,
        proposerIdentity: agent3PDA,
        agreement: agrPda3,
        proposerParty: proposerParty3,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`\n✅ Proposed Agreement 3 (Pending): ${agrPda3.toBase58()}`);

    // Add Agent 2 but don't sign yet
    const [party2_agr3] = getPartyPDA(agrId3, agent2PDA);
    await (prog3.methods as any)
      .addParty(agrId3, 1)
      .accounts({
        proposerSigner: agent3Key.publicKey,
        proposerIdentity: agent3PDA,
        agreement: agrPda3,
        partyIdentity: agent2PDA,
        party: party2_agr3,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`   Added Agent 2 — awaiting signatures`);
  } catch (e: any) {
    console.log(`❌ Agreement 3 failed: ${e.message?.slice(0, 200)}`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("\nAgent keys (save these):");
  console.log(`  Agent 1 (Trading Alpha):    ${agent1Key.publicKey.toBase58()}`);
  console.log(`  Agent 2 (Analytics Beta):   ${agent2Key.publicKey.toBase58()}`);
  console.log(`  Agent 3 (Governance Gamma): ${agent3Key.publicKey.toBase58()}`);

  const finalBalance = await connection.getBalance(deployer.publicKey);
  console.log(`\nRemaining balance: ${finalBalance / 1e9} SOL`);
}

main().catch(console.error);

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PROGRAM_ID = new web3_js_1.PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");
// Load IDL
const idlPath = path.join(__dirname, "idl", "agent_agreement_protocol.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
// Load deployer wallet
const walletPath = "/root/.config/solana/id.json";
const secret = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
const deployer = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(secret));
function getAgentPDA(agentKey) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agent"), agentKey.toBuffer()], PROGRAM_ID);
}
function getAgreementPDA(agreementId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agreement"), Buffer.from(agreementId)], PROGRAM_ID);
}
function getPartyPDA(agreementId, identityPDA) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("party"), Buffer.from(agreementId), identityPDA.toBuffer()], PROGRAM_ID);
}
function randomAgreementId() {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}
async function main() {
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
    const wallet = new anchor.Wallet(deployer);
    const provider = new anchor_1.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new anchor_1.Program(idl, provider);
    console.log("Deployer:", deployer.publicKey.toBase58());
    const balance = await connection.getBalance(deployer.publicKey);
    console.log("Balance:", balance / 1e9, "SOL");
    // === Register 3 agents ===
    const agent1Key = web3_js_1.Keypair.generate();
    const agent2Key = web3_js_1.Keypair.generate();
    const agent3Key = web3_js_1.Keypair.generate();
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
            maxCommitLamports: new anchor_1.BN(agent.maxCommit * 1e9),
            expiresAt: new anchor_1.BN(Math.floor(Date.now() / 1000) + 365 * 86400), // 1 year
        };
        try {
            await program.methods
                .registerAgent(agent.key.publicKey, metadataHash, scope)
                .accounts({
                authority: deployer.publicKey,
                agentIdentity: pda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .rpc();
            console.log(`✅ Registered "${agent.name}" → ${agent.key.publicKey.toBase58()}`);
            console.log(`   PDA: ${pda.toBase58()}`);
        }
        catch (e) {
            console.log(`❌ Failed "${agent.name}": ${e.message?.slice(0, 100)}`);
        }
    }
    // === Create agreements ===
    // Agreement 1: Service contract between Agent 1 and Agent 2
    const agrId1 = randomAgreementId();
    const [agrPda1] = getAgreementPDA(agrId1);
    const [agent1PDA] = getAgentPDA(agent1Key.publicKey);
    const [agent2PDA] = getAgentPDA(agent2Key.publicKey);
    const [agent3PDA] = getAgentPDA(agent3Key.publicKey);
    const [proposerParty1] = getPartyPDA(agrId1, agent1PDA);
    try {
        const termsHash = new Array(32).fill(0);
        Buffer.from("Market analysis service contract").copy(Buffer.from(termsHash), 0);
        const termsUri = new Array(64).fill(0);
        Buffer.from("ipfs://QmServiceContract001").copy(Buffer.from(termsUri), 0);
        await program.methods
            .proposeAgreement(agrId1, 1, // SERVICE type
        0, // PUBLIC visibility
        termsHash, termsUri, 2, // num_parties
        new anchor_1.BN(Math.floor(Date.now() / 1000) + 90 * 86400) // expires in 90 days
        )
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent1PDA,
            agreement: agrPda1,
            proposerParty: proposerParty1,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`\n✅ Proposed Agreement 1 (Service): ${agrPda1.toBase58()}`);
        // Add Agent 2 as counterparty
        const [party2_agr1] = getPartyPDA(agrId1, agent2PDA);
        await program.methods
            .addParty(agrId1, 1) // COUNTERPARTY role
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent1PDA,
            agreement: agrPda1,
            partyIdentity: agent2PDA,
            party: party2_agr1,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`   Added Agent 2 as counterparty`);
        // Agent 1 signs (proposer)
        await program.methods
            .signAgreement(agrId1)
            .accounts({
            signer: deployer.publicKey,
            signerIdentity: agent1PDA,
            agreement: agrPda1,
            party: proposerParty1,
        })
            .rpc();
        console.log(`   Agent 1 signed`);
        // Agent 2 signs (counterparty) - makes it ACTIVE
        await program.methods
            .signAgreement(agrId1)
            .accounts({
            signer: deployer.publicKey,
            signerIdentity: agent2PDA,
            agreement: agrPda1,
            party: party2_agr1,
        })
            .rpc();
        console.log(`   Agent 2 signed → Agreement ACTIVE ✅`);
    }
    catch (e) {
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
        await program.methods
            .proposeAgreement(agrId2, 2, // PARTNERSHIP type
        0, // PUBLIC
        termsHash2, termsUri2, 2, new anchor_1.BN(Math.floor(Date.now() / 1000) + 180 * 86400) // 180 days
        )
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent1PDA,
            agreement: agrPda2,
            proposerParty: proposerParty2,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`\n✅ Proposed Agreement 2 (Partnership): ${agrPda2.toBase58()}`);
        // Add Agent 3
        const [party3_agr2] = getPartyPDA(agrId2, agent3PDA);
        await program.methods
            .addParty(agrId2, 1)
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent1PDA,
            agreement: agrPda2,
            partyIdentity: agent3PDA,
            party: party3_agr2,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`   Added Agent 3 as counterparty`);
        // Both sign
        await program.methods
            .signAgreement(agrId2)
            .accounts({
            signer: deployer.publicKey,
            signerIdentity: agent1PDA,
            agreement: agrPda2,
            party: proposerParty2,
        })
            .rpc();
        await program.methods
            .signAgreement(agrId2)
            .accounts({
            signer: deployer.publicKey,
            signerIdentity: agent3PDA,
            agreement: agrPda2,
            party: party3_agr2,
        })
            .rpc();
        console.log(`   Both signed → Agreement ACTIVE ✅`);
        // Fulfill this one
        await program.methods
            .fulfillAgreement(agrId2)
            .accounts({
            signer: deployer.publicKey,
            signerIdentity: agent1PDA,
            signerParty: proposerParty2,
            agreement: agrPda2,
        })
            .rpc();
        console.log(`   Agent 1 marked FULFILLED ✅`);
    }
    catch (e) {
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
        await program.methods
            .proposeAgreement(agrId3, 1, // SERVICE
        0, // PUBLIC
        termsHash3, termsUri3, 2, new anchor_1.BN(Math.floor(Date.now() / 1000) + 30 * 86400) // 30 days
        )
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent3PDA,
            agreement: agrPda3,
            proposerParty: proposerParty3,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`\n✅ Proposed Agreement 3 (Pending): ${agrPda3.toBase58()}`);
        // Add Agent 2 but don't sign yet
        const [party2_agr3] = getPartyPDA(agrId3, agent2PDA);
        await program.methods
            .addParty(agrId3, 1)
            .accounts({
            proposerSigner: deployer.publicKey,
            proposerIdentity: agent3PDA,
            agreement: agrPda3,
            partyIdentity: agent2PDA,
            party: party2_agr3,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log(`   Added Agent 2 — awaiting signatures`);
    }
    catch (e) {
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

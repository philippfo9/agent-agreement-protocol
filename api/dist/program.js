"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgramClient = createProgramClient;
exports.findAgentIdentityPDA = findAgentIdentityPDA;
exports.findAgreementPDA = findAgreementPDA;
exports.findAgreementPartyPDA = findAgreementPartyPDA;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const PROGRAM_ID = new web3_js_1.PublicKey("4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe");
// Minimal IDL — just enough for account deserialization.
// In production, load the full IDL from anchor build output.
const IDL = {
    version: "0.1.0",
    name: "agent_agreement_protocol",
    instructions: [],
    accounts: [
        {
            name: "AgentIdentity",
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "publicKey" },
                    { name: "agentKey", type: "publicKey" },
                    { name: "metadataHash", type: { array: ["u8", 32] } },
                    {
                        name: "scope",
                        type: {
                            defined: "DelegationScope",
                        },
                    },
                    { name: "parent", type: "publicKey" },
                    { name: "createdAt", type: "i64" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
        {
            name: "Agreement",
            type: {
                kind: "struct",
                fields: [
                    { name: "agreementId", type: { array: ["u8", 16] } },
                    { name: "agreementType", type: "u8" },
                    { name: "status", type: "u8" },
                    { name: "visibility", type: "u8" },
                    { name: "proposer", type: "publicKey" },
                    { name: "termsHash", type: { array: ["u8", 32] } },
                    { name: "termsUri", type: { array: ["u8", 64] } },
                    { name: "escrowVault", type: "publicKey" },
                    { name: "escrowMint", type: "publicKey" },
                    { name: "escrowTotal", type: "u64" },
                    { name: "numParties", type: "u8" },
                    { name: "numSigned", type: "u8" },
                    { name: "partiesAdded", type: "u8" },
                    { name: "createdAt", type: "i64" },
                    { name: "expiresAt", type: "i64" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
        {
            name: "AgreementParty",
            type: {
                kind: "struct",
                fields: [
                    { name: "agreement", type: "publicKey" },
                    { name: "agentIdentity", type: "publicKey" },
                    { name: "role", type: "u8" },
                    { name: "signed", type: "bool" },
                    { name: "signedAt", type: "i64" },
                    { name: "escrowDeposited", type: "u64" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
    ],
    types: [
        {
            name: "DelegationScope",
            type: {
                kind: "struct",
                fields: [
                    { name: "canSignAgreements", type: "bool" },
                    { name: "canCommitFunds", type: "bool" },
                    { name: "maxCommitLamports", type: "u64" },
                    { name: "expiresAt", type: "i64" },
                ],
            },
        },
    ],
};
function createProgramClient(rpcUrl) {
    const connection = new web3_js_1.Connection(rpcUrl, "confirmed");
    // Read-only provider (dummy wallet — we don't sign server-side)
    const dummyWallet = new anchor_1.Wallet(web3_js_1.Keypair.generate());
    const provider = new anchor_1.AnchorProvider(connection, dummyWallet, {
        commitment: "confirmed",
    });
    (0, anchor_1.setProvider)(provider);
    const program = new anchor_1.Program(IDL, PROGRAM_ID, provider);
    return { connection, program };
}
function findAgentIdentityPDA(agentKey) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agent"), agentKey.toBuffer()], PROGRAM_ID);
}
function findAgreementPDA(agreementId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agreement"), Buffer.from(agreementId)], PROGRAM_ID);
}
function findAgreementPartyPDA(agreementId, agentIdentity) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("party"), Buffer.from(agreementId), agentIdentity.toBuffer()], PROGRAM_ID);
}

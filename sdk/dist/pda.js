"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROGRAM_ID = void 0;
exports.findAgentIdentityPDA = findAgentIdentityPDA;
exports.findAgreementPDA = findAgreementPDA;
exports.findAgreementPartyPDA = findAgreementPartyPDA;
exports.findEscrowVaultPDA = findEscrowVaultPDA;
const web3_js_1 = require("@solana/web3.js");
exports.PROGRAM_ID = new web3_js_1.PublicKey("4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe");
function findAgentIdentityPDA(agentKey, programId = exports.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agent"), agentKey.toBuffer()], programId);
}
function findAgreementPDA(agreementId, programId = exports.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("agreement"), Buffer.from(agreementId)], programId);
}
function findAgreementPartyPDA(agreementId, agentIdentity, programId = exports.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from("party"),
        Buffer.from(agreementId),
        agentIdentity.toBuffer(),
    ], programId);
}
function findEscrowVaultPDA(agreementId, programId = exports.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), Buffer.from(agreementId)], programId);
}
//# sourceMappingURL=pda.js.map
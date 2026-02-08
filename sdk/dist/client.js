"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AAPClient = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const pda_1 = require("./pda");
/**
 * High-level client for the Agent Agreement Protocol.
 *
 * For read operations, only a Connection is needed.
 * For write operations, pass an AnchorProvider with a wallet.
 */
class AAPClient {
    constructor(program) {
        this.program = program;
        this.connection = program.provider.connection;
        this.programId = program.programId;
    }
    // ── Read Methods ──
    async getAgentIdentity(agentKey) {
        const [pda] = (0, pda_1.findAgentIdentityPDA)(agentKey, this.programId);
        try {
            const account = await this.program.account.agentIdentity.fetch(pda);
            return account;
        }
        catch {
            return null;
        }
    }
    async getAgentIdentityByPDA(pda) {
        try {
            const account = await this.program.account.agentIdentity.fetch(pda);
            return account;
        }
        catch {
            return null;
        }
    }
    async getAgreement(agreementId) {
        const [pda] = (0, pda_1.findAgreementPDA)(agreementId, this.programId);
        try {
            const account = await this.program.account.agreement.fetch(pda);
            return account;
        }
        catch {
            return null;
        }
    }
    async getAgreementByPDA(pda) {
        try {
            const account = await this.program.account.agreement.fetch(pda);
            return account;
        }
        catch {
            return null;
        }
    }
    async getAgreementParty(agreementId, agentIdentityPDA) {
        const [pda] = (0, pda_1.findAgreementPartyPDA)(agreementId, agentIdentityPDA, this.programId);
        try {
            const account = await this.program.account.agreementParty.fetch(pda);
            return account;
        }
        catch {
            return null;
        }
    }
    async getAllAgents() {
        const accounts = await this.program.account.agentIdentity.all();
        return accounts.map((a) => ({
            pubkey: a.publicKey,
            account: a.account,
        }));
    }
    async getAllAgreements() {
        const accounts = await this.program.account.agreement.all();
        return accounts.map((a) => ({
            pubkey: a.publicKey,
            account: a.account,
        }));
    }
    async getAgreementsForAgent(agentIdentityPDA) {
        const parties = await this.program.account.agreementParty.all([
            {
                memcmp: {
                    offset: 8 + 32, // after discriminator + agreement pubkey
                    bytes: agentIdentityPDA.toBase58(),
                },
            },
        ]);
        return parties.map((a) => ({
            pubkey: a.publicKey,
            account: a.account,
        }));
    }
    // ── Write Methods ──
    async registerAgent(authority, params) {
        const [agentIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(params.agentKey, this.programId);
        const scope = {
            canSignAgreements: params.scope.canSignAgreements,
            canCommitFunds: params.scope.canCommitFunds,
            maxCommitLamports: new anchor_1.BN(params.scope.maxCommitLamports.toString()),
            expiresAt: new anchor_1.BN(params.scope.expiresAt.toString()),
        };
        const tx = await this.program.methods
            .registerAgent(params.agentKey, Array.from(params.metadataHash), scope)
            .accounts({
            authority,
            agentIdentity: agentIdentityPDA,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return tx;
    }
    async proposeAgreement(proposerAgentKey, params) {
        const [proposerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(proposerAgentKey, this.programId);
        const agreementIdArr = Array.from(params.agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, proposerIdentityPDA, this.programId);
        const tx = await this.program.methods
            .proposeAgreement(agreementIdArr, params.agreementType, params.visibility, Array.from(params.termsHash), Array.from(params.termsUri), params.numParties, new anchor_1.BN(params.expiresAt.toString()))
            .accounts({
            proposerSigner: proposerAgentKey,
            proposerIdentity: proposerIdentityPDA,
            agreement: agreementPDA,
            proposerParty: partyPDA,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return { tx, agreementPDA, partyPDA };
    }
    async addParty(proposerAgentKey, params) {
        const [proposerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(proposerAgentKey, this.programId);
        const agreementIdArr = Array.from(params.agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, params.partyIdentity, this.programId);
        const tx = await this.program.methods
            .addParty(agreementIdArr, params.role)
            .accounts({
            proposerSigner: proposerAgentKey,
            proposerIdentity: proposerIdentityPDA,
            agreement: agreementPDA,
            partyIdentity: params.partyIdentity,
            party: partyPDA,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return tx;
    }
    async signAgreement(signerAgentKey, agreementId) {
        const [signerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(signerAgentKey, this.programId);
        const agreementIdArr = Array.from(agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, signerIdentityPDA, this.programId);
        const tx = await this.program.methods
            .signAgreement(agreementIdArr)
            .accounts({
            signer: signerAgentKey,
            signerIdentity: signerIdentityPDA,
            agreement: agreementPDA,
            party: partyPDA,
        })
            .rpc();
        return tx;
    }
    async cancelAgreement(signerKey, proposerAgentKey, agreementId) {
        const [proposerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(proposerAgentKey, this.programId);
        const agreementIdArr = Array.from(agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const tx = await this.program.methods
            .cancelAgreement(agreementIdArr)
            .accounts({
            signer: signerKey,
            proposerIdentity: proposerIdentityPDA,
            agreement: agreementPDA,
        })
            .rpc();
        return tx;
    }
    async fulfillAgreement(signerKey, signerAgentKey, agreementId) {
        const [signerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(signerAgentKey, this.programId);
        const agreementIdArr = Array.from(agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, signerIdentityPDA, this.programId);
        const tx = await this.program.methods
            .fulfillAgreement(agreementIdArr)
            .accounts({
            signer: signerKey,
            signerIdentity: signerIdentityPDA,
            signerParty: partyPDA,
            agreement: agreementPDA,
        })
            .rpc();
        return tx;
    }
    async closeAgreement(authority, agentKey, agreementId) {
        const [signerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(agentKey, this.programId);
        const agreementIdArr = Array.from(agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, signerIdentityPDA, this.programId);
        const tx = await this.program.methods
            .closeAgreement(agreementIdArr)
            .accounts({
            signer: authority,
            signerIdentity: signerIdentityPDA,
            signerParty: partyPDA,
            agreement: agreementPDA,
        })
            .rpc();
        return tx;
    }
    // ── Utility: Build unsigned transactions ──
    async buildRegisterAgentTx(authority, params) {
        const [agentIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(params.agentKey, this.programId);
        const scope = {
            canSignAgreements: params.scope.canSignAgreements,
            canCommitFunds: params.scope.canCommitFunds,
            maxCommitLamports: new anchor_1.BN(params.scope.maxCommitLamports.toString()),
            expiresAt: new anchor_1.BN(params.scope.expiresAt.toString()),
        };
        return await this.program.methods
            .registerAgent(params.agentKey, Array.from(params.metadataHash), scope)
            .accounts({
            authority,
            agentIdentity: agentIdentityPDA,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
    }
    async buildProposeAgreementTx(proposerAgentKey, params) {
        const [proposerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(proposerAgentKey, this.programId);
        const agreementIdArr = Array.from(params.agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, proposerIdentityPDA, this.programId);
        const transaction = await this.program.methods
            .proposeAgreement(agreementIdArr, params.agreementType, params.visibility, Array.from(params.termsHash), Array.from(params.termsUri), params.numParties, new anchor_1.BN(params.expiresAt.toString()))
            .accounts({
            proposerSigner: proposerAgentKey,
            proposerIdentity: proposerIdentityPDA,
            agreement: agreementPDA,
            proposerParty: partyPDA,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        return { transaction, agreementPDA };
    }
    async buildSignAgreementTx(signerAgentKey, agreementId) {
        const [signerIdentityPDA] = (0, pda_1.findAgentIdentityPDA)(signerAgentKey, this.programId);
        const agreementIdArr = Array.from(agreementId);
        const [agreementPDA] = (0, pda_1.findAgreementPDA)(agreementIdArr, this.programId);
        const [partyPDA] = (0, pda_1.findAgreementPartyPDA)(agreementIdArr, signerIdentityPDA, this.programId);
        return await this.program.methods
            .signAgreement(agreementIdArr)
            .accounts({
            signer: signerAgentKey,
            signerIdentity: signerIdentityPDA,
            agreement: agreementPDA,
            party: partyPDA,
        })
            .transaction();
    }
}
exports.AAPClient = AAPClient;
//# sourceMappingURL=client.js.map
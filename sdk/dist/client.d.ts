import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { RegisterAgentParams, ProposeAgreementParams, AddPartyParams, AgentIdentity, Agreement, AgreementParty } from "./types";
/**
 * High-level client for the Agent Agreement Protocol.
 *
 * For read operations, only a Connection is needed.
 * For write operations, pass an AnchorProvider with a wallet.
 */
export declare class AAPClient {
    program: Program;
    connection: Connection;
    programId: PublicKey;
    constructor(program: Program);
    getAgentIdentity(agentKey: PublicKey): Promise<AgentIdentity | null>;
    getAgentIdentityByPDA(pda: PublicKey): Promise<AgentIdentity | null>;
    getAgreement(agreementId: Uint8Array | number[]): Promise<Agreement | null>;
    getAgreementByPDA(pda: PublicKey): Promise<Agreement | null>;
    getAgreementParty(agreementId: Uint8Array | number[], agentIdentityPDA: PublicKey): Promise<AgreementParty | null>;
    getAllAgents(): Promise<{
        pubkey: PublicKey;
        account: AgentIdentity;
    }[]>;
    getAllAgreements(): Promise<{
        pubkey: PublicKey;
        account: Agreement;
    }[]>;
    getAgreementsForAgent(agentIdentityPDA: PublicKey): Promise<{
        pubkey: PublicKey;
        account: AgreementParty;
    }[]>;
    registerAgent(authority: PublicKey, params: RegisterAgentParams): Promise<string>;
    proposeAgreement(proposerAgentKey: PublicKey, params: ProposeAgreementParams): Promise<{
        tx: string;
        agreementPDA: PublicKey;
        partyPDA: PublicKey;
    }>;
    addParty(proposerAgentKey: PublicKey, params: AddPartyParams): Promise<string>;
    signAgreement(signerAgentKey: PublicKey, agreementId: Uint8Array | number[]): Promise<string>;
    cancelAgreement(signerKey: PublicKey, proposerAgentKey: PublicKey, agreementId: Uint8Array | number[]): Promise<string>;
    fulfillAgreement(signerKey: PublicKey, signerAgentKey: PublicKey, agreementId: Uint8Array | number[]): Promise<string>;
    closeAgreement(authority: PublicKey, agentKey: PublicKey, agreementId: Uint8Array | number[]): Promise<string>;
    buildRegisterAgentTx(authority: PublicKey, params: RegisterAgentParams): Promise<Transaction>;
    buildProposeAgreementTx(proposerAgentKey: PublicKey, params: ProposeAgreementParams): Promise<{
        transaction: Transaction;
        agreementPDA: PublicKey;
    }>;
    buildSignAgreementTx(signerAgentKey: PublicKey, agreementId: Uint8Array | number[]): Promise<Transaction>;
}
//# sourceMappingURL=client.d.ts.map
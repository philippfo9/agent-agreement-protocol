import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
export declare function createProgramClient(rpcUrl: string): {
    connection: Connection;
    program: Program<any>;
};
export declare function findAgentIdentityPDA(agentKey: PublicKey): [PublicKey, number];
export declare function findAgreementPDA(agreementId: number[]): [PublicKey, number];
export declare function findAgreementPartyPDA(agreementId: number[], agentIdentity: PublicKey): [PublicKey, number];

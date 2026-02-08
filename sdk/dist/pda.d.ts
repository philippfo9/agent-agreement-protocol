import { PublicKey } from "@solana/web3.js";
export declare const PROGRAM_ID: PublicKey;
export declare function findAgentIdentityPDA(agentKey: PublicKey, programId?: PublicKey): [PublicKey, number];
export declare function findAgreementPDA(agreementId: Uint8Array | number[], programId?: PublicKey): [PublicKey, number];
export declare function findAgreementPartyPDA(agreementId: Uint8Array | number[], agentIdentity: PublicKey, programId?: PublicKey): [PublicKey, number];
export declare function findEscrowVaultPDA(agreementId: Uint8Array | number[], programId?: PublicKey): [PublicKey, number];
//# sourceMappingURL=pda.d.ts.map
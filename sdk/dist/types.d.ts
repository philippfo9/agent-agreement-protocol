import { PublicKey } from "@solana/web3.js";
export declare enum AgreementType {
    Safe = 0,
    Service = 1,
    RevenueShare = 2,
    JointVenture = 3,
    Custom = 4
}
export declare enum AgreementStatus {
    Proposed = 0,
    Active = 1,
    Fulfilled = 2,
    Breached = 3,
    Disputed = 4,
    Cancelled = 5
}
export declare enum Visibility {
    Public = 0,
    Private = 1
}
export declare enum PartyRole {
    Proposer = 0,
    Counterparty = 1,
    Witness = 2,
    Arbitrator = 3
}
export interface DelegationScope {
    canSignAgreements: boolean;
    canCommitFunds: boolean;
    maxCommitLamports: bigint;
    expiresAt: bigint;
}
export interface AgentIdentity {
    authority: PublicKey;
    agentKey: PublicKey;
    metadataHash: Uint8Array;
    scope: DelegationScope;
    parent: PublicKey;
    createdAt: bigint;
    bump: number;
}
export interface Agreement {
    agreementId: Uint8Array;
    agreementType: AgreementType;
    status: AgreementStatus;
    visibility: Visibility;
    proposer: PublicKey;
    termsHash: Uint8Array;
    termsUri: Uint8Array;
    escrowVault: PublicKey;
    escrowMint: PublicKey;
    escrowTotal: bigint;
    numParties: number;
    numSigned: number;
    partiesAdded: number;
    createdAt: bigint;
    expiresAt: bigint;
    bump: number;
}
export interface AgreementParty {
    agreement: PublicKey;
    agentIdentity: PublicKey;
    role: PartyRole;
    signed: boolean;
    signedAt: bigint;
    escrowDeposited: bigint;
    bump: number;
}
export interface RegisterAgentParams {
    agentKey: PublicKey;
    metadataHash: number[] | Uint8Array;
    scope: {
        canSignAgreements: boolean;
        canCommitFunds: boolean;
        maxCommitLamports: number | bigint;
        expiresAt: number | bigint;
    };
}
export interface ProposeAgreementParams {
    agreementId: number[] | Uint8Array;
    agreementType: AgreementType;
    visibility: Visibility;
    termsHash: number[] | Uint8Array;
    termsUri: number[] | Uint8Array;
    numParties: number;
    expiresAt: number | bigint;
}
export interface AddPartyParams {
    agreementId: number[] | Uint8Array;
    partyIdentity: PublicKey;
    role: PartyRole;
}
//# sourceMappingURL=types.d.ts.map
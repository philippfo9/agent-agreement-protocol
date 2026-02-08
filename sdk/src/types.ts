import { PublicKey } from "@solana/web3.js";

// ── Enums (matching on-chain u8 constants) ──

export enum AgreementType {
  Safe = 0,
  Service = 1,
  RevenueShare = 2,
  JointVenture = 3,
  Custom = 4,
}

export enum AgreementStatus {
  Proposed = 0,
  Active = 1,
  Fulfilled = 2,
  Breached = 3,
  Disputed = 4,
  Cancelled = 5,
}

export enum Visibility {
  Public = 0,
  Private = 1,
}

export enum PartyRole {
  Proposer = 0,
  Counterparty = 1,
  Witness = 2,
  Arbitrator = 3,
}

// ── Structs ──

export interface DelegationScope {
  canSignAgreements: boolean;
  canCommitFunds: boolean;
  maxCommitLamports: bigint;
  expiresAt: bigint;
}

export interface AgentIdentity {
  authority: PublicKey;
  agentKey: PublicKey;
  metadataHash: Uint8Array; // 32 bytes
  scope: DelegationScope;
  parent: PublicKey;
  createdAt: bigint;
  bump: number;
}

export interface Agreement {
  agreementId: Uint8Array; // 16 bytes
  agreementType: AgreementType;
  status: AgreementStatus;
  visibility: Visibility;
  proposer: PublicKey;
  termsHash: Uint8Array; // 32 bytes
  termsUri: Uint8Array; // 64 bytes
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

// ── Instruction params ──

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
  agreementId: number[] | Uint8Array; // 16 bytes
  agreementType: AgreementType;
  visibility: Visibility;
  termsHash: number[] | Uint8Array; // 32 bytes
  termsUri: number[] | Uint8Array; // 64 bytes
  numParties: number;
  expiresAt: number | bigint;
}

export interface AddPartyParams {
  agreementId: number[] | Uint8Array;
  partyIdentity: PublicKey;
  role: PartyRole;
}

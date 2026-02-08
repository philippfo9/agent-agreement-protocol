import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface DelegationScope {
  canSignAgreements: boolean;
  canCommitFunds: boolean;
  maxCommitLamports: BN;
  expiresAt: BN;
}

export interface AgentIdentity {
  authority: PublicKey;
  agentKey: PublicKey;
  metadataHash: number[];
  scope: DelegationScope;
  parent: PublicKey;
  createdAt: BN;
  bump: number;
}

export interface Agreement {
  agreementId: number[];
  agreementType: number;
  status: number;
  visibility: number;
  proposer: PublicKey;
  termsHash: number[];
  termsUri: number[];
  escrowVault: PublicKey;
  escrowMint: PublicKey;
  escrowTotal: BN;
  numParties: number;
  numSigned: number;
  partiesAdded: number;
  createdAt: BN;
  expiresAt: BN;
  bump: number;
}

export interface AgreementParty {
  agreement: PublicKey;
  agentIdentity: PublicKey;
  role: number;
  signed: boolean;
  signedAt: BN;
  escrowDeposited: BN;
  bump: number;
}

export interface AgentIdentityAccount {
  publicKey: PublicKey;
  account: AgentIdentity;
}

export interface AgreementAccount {
  publicKey: PublicKey;
  account: Agreement;
}

export interface AgreementPartyAccount {
  publicKey: PublicKey;
  account: AgreementParty;
}

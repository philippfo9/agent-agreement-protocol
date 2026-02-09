import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ"
);

export function findAgentIdentityPDA(
  agentKey: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentKey.toBuffer()],
    programId
  );
}

export function findAgreementPDA(
  agreementId: Uint8Array | number[],
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    programId
  );
}

export function findAgreementPartyPDA(
  agreementId: Uint8Array | number[],
  agentIdentity: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("party"),
      Buffer.from(agreementId),
      agentIdentity.toBuffer(),
    ],
    programId
  );
}

export function findEscrowVaultPDA(
  agreementId: Uint8Array | number[],
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(agreementId)],
    programId
  );
}

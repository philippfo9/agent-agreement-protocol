import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";

export function getAgentIdentityPDA(agentKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getAgreementPDA(agreementId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    PROGRAM_ID
  );
}

export function getAgreementPartyPDA(
  agreementId: Uint8Array,
  agentIdentity: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("party"), Buffer.from(agreementId), agentIdentity.toBuffer()],
    PROGRAM_ID
  );
}

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, Idl, setProvider } from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");

// Minimal IDL — just enough for account deserialization.
// In production, load the full IDL from anchor build output.
const IDL: Idl = {
  version: "0.1.0",
  name: "agent_agreement_protocol",
  instructions: [],
  accounts: [
    {
      name: "AgentIdentity",
      type: {
        kind: "struct" as const,
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "agentKey", type: "publicKey" },
          { name: "metadataHash", type: { array: ["u8", 32] } },
          {
            name: "scope",
            type: {
              defined: "DelegationScope",
            },
          },
          { name: "parent", type: "publicKey" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Agreement",
      type: {
        kind: "struct" as const,
        fields: [
          { name: "agreementId", type: { array: ["u8", 16] } },
          { name: "agreementType", type: "u8" },
          { name: "status", type: "u8" },
          { name: "visibility", type: "u8" },
          { name: "proposer", type: "publicKey" },
          { name: "termsHash", type: { array: ["u8", 32] } },
          { name: "termsUri", type: { array: ["u8", 64] } },
          { name: "escrowVault", type: "publicKey" },
          { name: "escrowMint", type: "publicKey" },
          { name: "escrowTotal", type: "u64" },
          { name: "numParties", type: "u8" },
          { name: "numSigned", type: "u8" },
          { name: "partiesAdded", type: "u8" },
          { name: "createdAt", type: "i64" },
          { name: "expiresAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "AgreementParty",
      type: {
        kind: "struct" as const,
        fields: [
          { name: "agreement", type: "publicKey" },
          { name: "agentIdentity", type: "publicKey" },
          { name: "role", type: "u8" },
          { name: "signed", type: "bool" },
          { name: "signedAt", type: "i64" },
          { name: "escrowDeposited", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "DelegationScope",
      type: {
        kind: "struct" as const,
        fields: [
          { name: "canSignAgreements", type: "bool" },
          { name: "canCommitFunds", type: "bool" },
          { name: "maxCommitLamports", type: "u64" },
          { name: "expiresAt", type: "i64" },
        ],
      },
    },
  ],
} as any;

export function createProgramClient(rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");
  // Read-only provider (dummy wallet — we don't sign server-side)
  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  setProvider(provider);
  const program = new Program(IDL as any, PROGRAM_ID as any, provider as any);
  return { connection, program };
}

export function findAgentIdentityPDA(agentKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentKey.toBuffer()],
    PROGRAM_ID
  );
}

export function findAgreementPDA(agreementId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    PROGRAM_ID
  );
}

export function findAgreementPartyPDA(
  agreementId: number[],
  agentIdentity: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("party"), Buffer.from(agreementId), agentIdentity.toBuffer()],
    PROGRAM_ID
  );
}

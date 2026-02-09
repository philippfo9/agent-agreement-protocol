// Minimal IDL type definition for AAP program
// This allows Anchor to deserialize accounts without a full IDL JSON file

export const AAP_IDL = {
  version: "0.1.0",
  name: "agent_agreement_protocol",
  address: "BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ",
  metadata: {
    name: "agent_agreement_protocol",
    version: "0.1.0",
    spec: "0.1.0",
  },
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
} as const;

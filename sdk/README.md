# @aap/sdk — Agent Agreement Protocol TypeScript SDK

TypeScript SDK for interacting with the Agent Agreement Protocol on Solana.

## Install

```bash
npm install @aap/sdk
```

## Quick Start

```typescript
import { AAPClient, findAgentIdentityPDA, AgreementType, Visibility, PartyRole } from "@aap/sdk";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";

// Initialize (with your Anchor program instance)
const client = new AAPClient(program);

// Register an agent
await client.registerAgent(authority.publicKey, {
  agentKey: agentKeypair.publicKey,
  metadataHash: new Uint8Array(32), // SHA-256 of your metadata JSON
  scope: {
    canSignAgreements: true,
    canCommitFunds: false,
    maxCommitLamports: 0,
    expiresAt: 0, // never
  },
});

// Read agent identity
const identity = await client.getAgentIdentity(agentKeypair.publicKey);

// Propose an agreement
const agreementId = crypto.getRandomValues(new Uint8Array(16));
const { agreementPDA } = await client.proposeAgreement(agentKeypair.publicKey, {
  agreementId,
  agreementType: AgreementType.Service,
  visibility: Visibility.Public,
  termsHash: new Uint8Array(32),
  termsUri: new Uint8Array(64),
  numParties: 2,
  expiresAt: 0,
});

// Add counterparty & sign
await client.addParty(agentKeypair.publicKey, {
  agreementId,
  partyIdentity: counterpartyIdentityPDA,
  role: PartyRole.Counterparty,
});

await client.signAgreement(counterpartyAgentKey.publicKey, agreementId);
```

## PDA Helpers

```typescript
import { findAgentIdentityPDA, findAgreementPDA, findAgreementPartyPDA } from "@aap/sdk";

const [identityPDA, bump] = findAgentIdentityPDA(agentPubkey);
const [agreementPDA] = findAgreementPDA(agreementId);
const [partyPDA] = findAgreementPartyPDA(agreementId, identityPDA);
```

## Building Unsigned Transactions

For agents that need to return transactions for external signing:

```typescript
const tx = await client.buildRegisterAgentTx(authority, params);
// Serialize and return to caller for signing
const serialized = tx.serialize({ requireAllSignatures: false });
```

## API

### Read Methods
- `getAgentIdentity(agentKey)` — Fetch agent by their signing key
- `getAgentIdentityByPDA(pda)` — Fetch agent by PDA address
- `getAgreement(agreementId)` — Fetch agreement by ID
- `getAgreementParty(agreementId, agentIdentityPDA)` — Fetch party record
- `getAllAgents()` — List all registered agents
- `getAllAgreements()` — List all agreements
- `getAgreementsForAgent(agentIdentityPDA)` — List agreements for an agent

### Write Methods
- `registerAgent(authority, params)` — Register new agent identity
- `proposeAgreement(agentKey, params)` — Propose agreement
- `addParty(proposerAgentKey, params)` — Add party to proposal
- `signAgreement(agentKey, agreementId)` — Sign agreement
- `cancelAgreement(signer, proposerAgentKey, agreementId)` — Cancel proposal
- `fulfillAgreement(signer, agentKey, agreementId)` — Mark fulfilled
- `closeAgreement(authority, agentKey, agreementId)` — Close & reclaim rent

### Transaction Builders
- `buildRegisterAgentTx(authority, params)` — Returns unsigned Transaction
- `buildProposeAgreementTx(agentKey, params)` — Returns unsigned Transaction + PDA
- `buildSignAgreementTx(agentKey, agreementId)` — Returns unsigned Transaction

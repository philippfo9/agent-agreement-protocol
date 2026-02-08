# Agent Agreement Protocol (AAP)

On-chain agent identity and bilateral agreements on Solana.

**Program ID:** `4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe`
**Network:** Devnet (configurable)
**API Base:** `http://localhost:3000` (or wherever the AAP API is running)

---

## Quick Start — Register Your Identity in 2 Commands

```bash
# 1. Generate an agent keypair (or use your existing one)
AGENT_KEY="your-agent-pubkey"
AUTHORITY="your-human-authority-pubkey"

# 2. Get the registration transaction
curl -s http://localhost:3000/agents/register \
  -H 'Content-Type: application/json' \
  -d "{\"authority\":\"$AUTHORITY\",\"agentKey\":\"$AGENT_KEY\"}" \
  | jq .

# Returns: { "transaction": "base64...", "agentIdentityPDA": "..." }
# Sign the transaction with the authority wallet and submit to Solana
```

That's it. You now have an on-chain identity.

---

## Concepts

### Agent Identity
Every AI agent gets a PDA (Program Derived Address) on Solana linking it to a human authority. The identity includes:
- **authority** — human wallet that controls this agent
- **agent_key** — the agent's own signing keypair
- **scope** — what the agent is allowed to do (sign agreements, commit funds, spending limits, expiry)
- **parent** — optional parent agent (for sub-agents)

### Delegation Scope
```json
{
  "canSignAgreements": true,
  "canCommitFunds": false,
  "maxCommitLamports": 0,
  "expiresAt": 0
}
```
- `canSignAgreements` — can this agent enter agreements?
- `canCommitFunds` — can it lock tokens in escrow?
- `maxCommitLamports` — max escrow per agreement (0 = unlimited)
- `expiresAt` — Unix timestamp when delegation expires (0 = never)

### Agreements
Bilateral or multilateral contracts between agents. Flow:
1. Agent A **proposes** → creates Agreement PDA + proposer party (auto-signed)
2. Agent A **adds parties** → creates AgreementParty PDAs
3. Parties **sign** → when all sign, status becomes Active
4. Any party **fulfills** → status becomes Fulfilled
5. Authority **closes** → PDAs deleted, rent reclaimed

### Agreement Types
| Value | Type | Use Case |
|-------|------|----------|
| 0 | Safe | Multi-sig style |
| 1 | Service | Agent-to-agent services |
| 2 | Revenue Share | Split earnings |
| 3 | Joint Venture | Collaborative projects |
| 4 | Custom | Anything else |

---

## API Reference

### Read Endpoints (no auth)

#### List Agents
```bash
curl http://localhost:3000/agents?limit=10&offset=0
```

#### Get Agent Identity
```bash
curl http://localhost:3000/agents/AGENT_PUBKEY
```
Returns authority, scope, parent, metadata hash, created_at.

#### List Agent's Agreements
```bash
curl http://localhost:3000/agents/AGENT_PUBKEY/agreements
```

#### Agent Stats
```bash
curl http://localhost:3000/agents/AGENT_PUBKEY/stats
# Returns: totalAgreements, activeCount, fulfilledCount, escrowVolume
```

#### List Agreements (with filters)
```bash
curl "http://localhost:3000/agreements?status=active&type=service&visibility=public&limit=20"
```

#### Get Agreement Details
```bash
# By PDA pubkey:
curl http://localhost:3000/agreements/AGREEMENT_PDA

# By agreement ID (32 hex chars):
curl http://localhost:3000/agreements/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```
Returns agreement details + all parties.

### Write Endpoints (return unsigned transactions)

All write endpoints return `{ "transaction": "base64..." }`. You must:
1. Deserialize the transaction
2. Sign it with the required wallet
3. Submit to Solana

#### Register Agent
```bash
curl -X POST http://localhost:3000/agents/register \
  -H 'Content-Type: application/json' \
  -d '{
    "authority": "HUMAN_WALLET_PUBKEY",
    "agentKey": "AGENT_PUBKEY",
    "metadataHash": "sha256hex...",
    "scope": {
      "canSignAgreements": true,
      "canCommitFunds": false,
      "maxCommitLamports": 0,
      "expiresAt": 0
    }
  }'
```
**Signer:** authority (human wallet)

#### Propose Agreement
```bash
# Generate a unique agreement ID
AGREEMENT_ID=$(openssl rand -hex 16)

curl -X POST http://localhost:3000/agreements/propose \
  -H 'Content-Type: application/json' \
  -d "{
    \"proposerAgentKey\": \"YOUR_AGENT_PUBKEY\",
    \"agreementId\": \"$AGREEMENT_ID\",
    \"agreementType\": 1,
    \"visibility\": 0,
    \"termsHash\": \"sha256-of-your-terms-document-hex\",
    \"termsUri\": \"arweave-tx-id-or-url\",
    \"numParties\": 2,
    \"expiresAt\": 0
  }"
```
**Signer:** proposer's agent_key

#### Sign Agreement
```bash
curl -X POST http://localhost:3000/agreements/$AGREEMENT_ID/sign \
  -H 'Content-Type: application/json' \
  -d '{"signerAgentKey": "COUNTERPARTY_AGENT_PUBKEY"}'
```
**Signer:** counterparty's agent_key

#### Cancel Agreement
```bash
curl -X POST http://localhost:3000/agreements/$AGREEMENT_ID/cancel \
  -H 'Content-Type: application/json' \
  -d '{
    "signerKey": "PROPOSER_AGENT_OR_AUTHORITY_PUBKEY",
    "proposerAgentKey": "PROPOSER_AGENT_PUBKEY"
  }'
```
**Signer:** proposer's agent_key OR authority

#### Fulfill Agreement
```bash
curl -X POST http://localhost:3000/agreements/$AGREEMENT_ID/fulfill \
  -H 'Content-Type: application/json' \
  -d '{
    "signerKey": "AGENT_OR_AUTHORITY_PUBKEY",
    "signerAgentKey": "AGENT_PUBKEY"
  }'
```
**Signer:** any party's agent_key or authority

---

## Example Flow: Agent-to-Agent Service Agreement

Two agents agree on a service contract (Agent A hires Agent B to perform a task).

```bash
API="http://localhost:3000"

# Step 1: Both agents should already be registered (see Quick Start)

# Step 2: Agent A proposes the agreement
AGREEMENT_ID=$(openssl rand -hex 16)

curl -X POST $API/agreements/propose \
  -H 'Content-Type: application/json' \
  -d "{
    \"proposerAgentKey\": \"$AGENT_A_PUBKEY\",
    \"agreementId\": \"$AGREEMENT_ID\",
    \"agreementType\": 1,
    \"visibility\": 0,
    \"termsHash\": \"$(echo -n 'Agent B performs data analysis for Agent A' | sha256sum | cut -d' ' -f1)\",
    \"termsUri\": \"https://arweave.net/tx-id-here\",
    \"numParties\": 2,
    \"expiresAt\": 0
  }"
# → Sign with Agent A's keypair, submit to Solana

# Step 3: Agent A adds Agent B as counterparty
# (This requires a direct Solana transaction — use the SDK or build manually)
# The add_party instruction needs: proposer signs, party_identity PDA passed

# Step 4: Agent B signs
curl -X POST $API/agreements/$AGREEMENT_ID/sign \
  -H 'Content-Type: application/json' \
  -d "{\"signerAgentKey\": \"$AGENT_B_PUBKEY\"}"
# → Sign with Agent B's keypair, submit
# Agreement is now ACTIVE (both parties signed)

# Step 5: Check status
curl $API/agreements/$AGREEMENT_ID

# Step 6: When work is done, either party fulfills
curl -X POST $API/agreements/$AGREEMENT_ID/fulfill \
  -H 'Content-Type: application/json' \
  -d "{
    \"signerKey\": \"$AGENT_A_PUBKEY\",
    \"signerAgentKey\": \"$AGENT_A_PUBKEY\"
  }"
# → Sign and submit. Agreement is now FULFILLED.
```

## Example Flow: Revenue Share with Terms Hash

```bash
# Terms document (could be JSON, markdown, anything)
TERMS='{"type":"revenue_share","split":{"agentA":60,"agentB":40},"duration":"90days"}'
TERMS_HASH=$(echo -n "$TERMS" | sha256sum | cut -d' ' -f1)

# Upload terms to Arweave/IPFS, get URI
TERMS_URI="arweave:abc123..."

AGREEMENT_ID=$(openssl rand -hex 16)

curl -X POST $API/agreements/propose \
  -H 'Content-Type: application/json' \
  -d "{
    \"proposerAgentKey\": \"$AGENT_A_PUBKEY\",
    \"agreementId\": \"$AGREEMENT_ID\",
    \"agreementType\": 2,
    \"visibility\": 0,
    \"termsHash\": \"$TERMS_HASH\",
    \"termsUri\": \"$TERMS_URI\",
    \"numParties\": 2,
    \"expiresAt\": 0
  }"

# Both parties can verify: download terms from URI, hash, compare to on-chain termsHash
```

---

## Raw Solana Transaction Approach

For agents with direct wallet access (no API needed):

```typescript
import { AAPClient, AgreementType, Visibility, PartyRole } from "@aap/sdk";

// Initialize with your Anchor program
const client = new AAPClient(program);

// Register
await client.registerAgent(authorityKeypair.publicKey, {
  agentKey: agentKeypair.publicKey,
  metadataHash: new Uint8Array(32),
  scope: { canSignAgreements: true, canCommitFunds: false, maxCommitLamports: 0, expiresAt: 0 },
});

// Propose
const agreementId = crypto.getRandomValues(new Uint8Array(16));
await client.proposeAgreement(agentKeypair.publicKey, {
  agreementId,
  agreementType: AgreementType.Service,
  visibility: Visibility.Public,
  termsHash: new Uint8Array(32),
  termsUri: new Uint8Array(64),
  numParties: 2,
  expiresAt: 0,
});

// Add party + Sign + Fulfill
await client.addParty(agentAKey.publicKey, {
  agreementId,
  partyIdentity: agentBIdentityPDA,
  role: PartyRole.Counterparty,
});
await client.signAgreement(agentBKey.publicKey, agreementId);
await client.fulfillAgreement(agentAKey.publicKey, agentAKey.publicKey, agreementId);
```

### PDA Derivation (for manual transaction building)

```typescript
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe");

// Agent Identity PDA
const [identityPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), agentPubkey.toBuffer()],
  PROGRAM_ID
);

// Agreement PDA
const [agreementPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("agreement"), Buffer.from(agreementId)],
  PROGRAM_ID
);

// Agreement Party PDA
const [partyPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("party"), Buffer.from(agreementId), agentIdentityPDA.toBuffer()],
  PROGRAM_ID
);
```

---

## Security Considerations

### Delegation Scopes
- **Always set `expiresAt`** for production agents. An agent with permanent delegation is a liability.
- **Use `maxCommitLamports`** to cap financial exposure per agreement.
- **Disable `canCommitFunds`** unless the agent genuinely needs escrow access.

### Human Authority
- The authority (human wallet) can always:
  - Update delegation scope
  - Revoke the agent entirely
  - Cancel proposed agreements
  - Fulfill agreements on behalf of the agent
- Agents **cannot** escalate their own permissions.
- Sub-agents cannot exceed parent agent's scope.

### Agreement Verification
- Always verify `termsHash` matches the actual terms document before signing.
- For private agreements, terms are encrypted off-chain (ECDH + AES-256-GCM).
- The on-chain `termsHash` is of the **plaintext**, not ciphertext.

### Sub-Agent Limits
- Maximum 2 levels: Human → Agent → Sub-agent
- Sub-agent scope must be ≤ parent scope
- Parent must have `canSignAgreements` to create sub-agents

---

## Costs

| Action | Rent (SOL) | Reclaimable? |
|--------|-----------|--------------|
| Register Agent | ~0.00144 | Yes (on revoke) |
| Propose Agreement | ~0.00315 | Yes (on close) |
| Add Party | ~0.00089 | Yes (on close) |
| **Total 2-party agreement** | **~0.00404** | **Fully reclaimable** |

All rent is returned when accounts are closed after fulfillment/cancellation.

# Agent Agreement Protocol (AAP) — V1 Architecture & Implementation Plan

## Scope: V1

V1 delivers two primitives only:
1. **Agent Identity Registry** — Minimal on-chain identity binding agent keypairs to human authority with scoped delegation
2. **Agreement Signing** — Public and private bilateral/multilateral agreements with escrow support

Everything else (entity formation, token launches, Crafts CPI, reputation scores, MCP server) is V2+. Keep it lean.

---

## Tech Stack

- **Anchor** (latest stable, currently 0.30.x)
- **Solana** devnet → mainnet
- **Testing**: Anchor + Bankrun (fast local tests, no validator needed)
- **Off-chain storage**: Arweave via Irys for encrypted agreement terms
- **Client SDK**: TypeScript (`@coral-xyz/anchor`)
- **Rust edition**: 2021

---

## Design Principles

1. **Minimal PDAs** — Every byte costs rent. Use fixed-size arrays, not Vecs. Pack fields tight. Use `u32` over `u64` where possible. No String fields on-chain (use `[u8; 32]` hashes or `[u8; 64]` for URIs).
2. **Test-driven** — Write the test first for every instruction. No instruction lands without a passing test.
3. **Low fees** — Minimize account sizes, use `init_if_needed` sparingly (it's larger), prefer explicit `init`. Close accounts when done to reclaim rent.
4. **Humans retain control** — Every agent action traces back to a human authority. Agents cannot escalate permissions.

---

## Account Schemas (Rent-Optimized)

### AgentIdentity

PDA seeds: `[b"agent", agent_pubkey.as_ref()]`

```rust
#[account]
pub struct AgentIdentity {
    pub authority: Pubkey,         // 32 bytes — human owner
    pub agent_key: Pubkey,         // 32 bytes — agent's signing key
    pub metadata_hash: [u8; 32],   // 32 bytes — SHA-256 of off-chain metadata JSON
    pub scope: DelegationScope,    // 11 bytes — what this agent can do
    pub parent: Pubkey,            // 32 bytes — Pubkey::default() if no parent
    pub created_at: i64,           // 8 bytes
    pub bump: u8,                  // 1 byte
}
// Total: 148 bytes + 8 (discriminator) = 156 bytes
// Rent: ~0.00144 SOL

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct DelegationScope {
    pub can_sign_agreements: bool,  // 1 byte
    pub can_commit_funds: bool,     // 1 byte
    pub max_commit_lamports: u64,   // 8 bytes — max value per agreement (0 = unlimited)
    pub expires_at: i64,            // 8 bytes — 0 = never expires
}
// Total: 18 bytes (but alignment pads to ~19 with bool packing)
```

**Why no Vec fields**: Vecs require 4 bytes length prefix + dynamic allocation. Fixed struct is predictable rent, faster deserialization, and cheaper CU.

### Agreement

PDA seeds: `[b"agreement", agreement_id.as_ref()]`

```rust
#[account]
pub struct Agreement {
    pub agreement_id: [u8; 16],     // 16 bytes — UUID or truncated hash (16 bytes is enough for uniqueness)
    pub agreement_type: u8,         // 1 byte — enum as u8
    pub status: u8,                 // 1 byte — enum as u8
    pub visibility: u8,             // 1 byte — 0 = public, 1 = private (hash-only)
    pub proposer: Pubkey,           // 32 bytes — AgentIdentity PDA
    pub terms_hash: [u8; 32],       // 32 bytes — SHA-256 of full terms document
    pub terms_uri: [u8; 64],        // 64 bytes — Arweave TX ID or URI (padded, null-terminated)
    pub escrow_vault: Pubkey,       // 32 bytes — PDA token account (Pubkey::default() if no escrow)
    pub escrow_mint: Pubkey,        // 32 bytes — token mint (SOL-wrapped or USDC)
    pub escrow_total: u64,          // 8 bytes — total escrow deposited
    pub num_parties: u8,            // 1 byte — how many parties (max 8)
    pub num_signed: u8,             // 1 byte — how many have signed
    pub created_at: i64,            // 8 bytes
    pub expires_at: i64,            // 8 bytes — 0 = no expiry
    pub bump: u8,                   // 1 byte
}
// Total: 238 bytes + 8 (discriminator) = 246 bytes
// Rent: ~0.00226 SOL
```

### AgreementParty

PDA seeds: `[b"party", agreement_id.as_ref(), agent_identity.as_ref()]`

One PDA per party per agreement. This avoids Vec<Party> in the Agreement account and keeps the Agreement PDA small and fixed-size.

```rust
#[account]
pub struct AgreementParty {
    pub agreement: Pubkey,          // 32 bytes — Agreement PDA
    pub agent_identity: Pubkey,     // 32 bytes — AgentIdentity PDA
    pub role: u8,                   // 1 byte — 0=Proposer, 1=Counterparty, 2=Witness, 3=Arbitrator
    pub signed: bool,               // 1 byte
    pub signed_at: i64,             // 8 bytes — 0 if not signed
    pub escrow_deposited: u64,      // 8 bytes — this party's escrow contribution
    pub bump: u8,                   // 1 byte
}
// Total: 83 bytes + 8 (discriminator) = 91 bytes
// Rent: ~0.00089 SOL
```

### EscrowVault

PDA seeds: `[b"escrow", agreement_id.as_ref()]`

This is just a token account (SPL Token / Token-2022) owned by the Agreement PDA. No custom struct needed — use the standard `TokenAccount` with PDA authority.

---

## Enums (Stored as u8 on-chain)

```rust
// AgreementType
pub const AGREEMENT_TYPE_SAFE: u8 = 0;
pub const AGREEMENT_TYPE_SERVICE: u8 = 1;
pub const AGREEMENT_TYPE_REVENUE_SHARE: u8 = 2;
pub const AGREEMENT_TYPE_JOINT_VENTURE: u8 = 3;
pub const AGREEMENT_TYPE_CUSTOM: u8 = 4;

// AgreementStatus
pub const STATUS_PROPOSED: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;      // All parties signed
pub const STATUS_FULFILLED: u8 = 2;
pub const STATUS_BREACHED: u8 = 3;
pub const STATUS_DISPUTED: u8 = 4;
pub const STATUS_CANCELLED: u8 = 5;

// Visibility
pub const VISIBILITY_PUBLIC: u8 = 0;
pub const VISIBILITY_PRIVATE: u8 = 1;

// PartyRole
pub const ROLE_PROPOSER: u8 = 0;
pub const ROLE_COUNTERPARTY: u8 = 1;
pub const ROLE_WITNESS: u8 = 2;
pub const ROLE_ARBITRATOR: u8 = 3;
```

---

## Instructions

### Module 1: Agent Registry

#### 1.1 `register_agent`

```
Signer: authority (human wallet)
Creates: AgentIdentity PDA
Args: agent_key, metadata_hash, scope
Validation:
  - authority is signer
  - agent_key != authority (agent must be separate key)
  - scope.expires_at == 0 || scope.expires_at > Clock::get().unix_timestamp
```

#### 1.2 `update_delegation`

```
Signer: authority
Mutates: AgentIdentity PDA
Args: new_scope
Validation:
  - authority == agent_identity.authority
```

#### 1.3 `register_sub_agent`

```
Signer: parent agent_key
Creates: new AgentIdentity PDA (with parent set)
Args: sub_agent_key, metadata_hash, scope
Validation:
  - parent AgentIdentity exists and is not expired
  - parent.scope.can_sign_agreements (sub-agent can't have more than parent)
  - new scope.max_commit_lamports <= parent.scope.max_commit_lamports
  - parent.parent must be default (max 2 levels: human -> agent -> sub-agent)
```

#### 1.4 `revoke_agent`

```
Signer: authority
Closes: AgentIdentity PDA (rent returned to authority)
Validation:
  - authority == agent_identity.authority
  - No active agreements (status == Active) — OR force flag that marks agent as revoked
    without closing, to not break existing agreement references
```

### Module 2: Agreement Engine

#### 2.1 `propose_agreement`

```
Signer: proposer's agent_key
Creates: Agreement PDA + AgreementParty PDA (for proposer)
Optional: Creates EscrowVault PDA + deposits tokens
Args:
  - agreement_id: [u8; 16]
  - agreement_type: u8
  - visibility: u8
  - terms_hash: [u8; 32]
  - terms_uri: [u8; 64]     (zeroed if private with no URI)
  - escrow_mint: Pubkey      (Pubkey::default() if no escrow)
  - escrow_amount: u64       (0 if no escrow)
  - num_parties: u8          (total including proposer)
  - expires_at: i64
Validation:
  - Proposer has valid AgentIdentity
  - AgentIdentity.scope.can_sign_agreements == true
  - Delegation not expired
  - If escrow: scope.can_commit_funds && amount <= scope.max_commit_lamports
  - num_parties >= 2 && num_parties <= 8
  - agreement_type is valid (0-4)
  - visibility is valid (0-1)
```

#### 2.2 `add_party`

```
Signer: proposer's agent_key
Creates: AgreementParty PDA for the new party
Args:
  - agreement_id: [u8; 16]
  - party_agent_identity: Pubkey
  - role: u8
Validation:
  - Agreement.status == Proposed
  - Signer is the proposer
  - Party's AgentIdentity PDA exists
  - Current party count < Agreement.num_parties
  - No duplicate party for same agent_identity
```

#### 2.3 `sign_agreement`

```
Signer: party's agent_key
Mutates: AgreementParty PDA (signed=true, signed_at=now)
Mutates: Agreement PDA (num_signed += 1, status -> Active if all signed)
Optional: Deposits escrow tokens
Args:
  - agreement_id: [u8; 16]
  - escrow_amount: u64 (0 if no escrow from this party)
Validation:
  - AgreementParty exists for this agent
  - AgreementParty.signed == false
  - Agreement.status == Proposed
  - Agreement not expired
  - AgentIdentity delegation still valid
  - If escrow: validate against delegation scope
Post-logic:
  - If num_signed == num_parties: set status = Active
```

#### 2.4 `cancel_agreement`

```
Signer: proposer's agent_key OR proposer's authority
Mutates: Agreement PDA (status -> Cancelled)
Returns: All escrowed funds to their depositors
Validation:
  - Agreement.status == Proposed (can only cancel before fully signed)
  - Signer is proposer or proposer's authority
```

#### 2.5 `fulfill_agreement`

```
Signer: any party's agent_key OR any party's authority
Mutates: Agreement PDA (status -> Fulfilled)
Releases: Escrow funds per agreement terms
Args:
  - agreement_id: [u8; 16]
  - escrow_distribution: Vec<(Pubkey, u64)>  // (party, amount) - must sum to escrow_total
Validation:
  - Agreement.status == Active
  - All parties must call fulfill (or use a 2-step: one proposes fulfillment, others confirm)
  - escrow_distribution amounts sum to escrow_total
Note: V1 uses simple "all parties agree it's fulfilled" model.
      V2 adds condition-based automatic fulfillment.
```

#### 2.6 `close_agreement`

```
Signer: any party's authority
Closes: Agreement PDA + all AgreementParty PDAs + EscrowVault
Returns: Rent to respective payers
Validation:
  - Agreement.status in [Fulfilled, Cancelled, Breached]
  - All escrow has been distributed
```

---

## Private Agreement Encryption (Off-chain)

For `visibility = PRIVATE`, the full agreement terms are encrypted off-chain before upload. The SDK handles this:

```typescript
// 1. Both agents derive a shared secret via ECDH
//    Convert Ed25519 keys to X25519 (libsodium: crypto_sign_ed25519_pk_to_curve25519)
//    Compute: sharedSecret = X25519(myPrivateKey, theirPublicKey)

// 2. Encrypt terms with AES-256-GCM using the shared secret
//    ciphertext = AES-256-GCM(sharedSecret, nonce, plaintext_terms)

// 3. Upload to Arweave via Irys
//    arweave_tx_id = await irys.upload(ciphertext)

// 4. Compute terms_hash from PLAINTEXT (not ciphertext)
//    terms_hash = SHA-256(plaintext_terms)

// 5. On-chain: terms_uri = arweave_tx_id (43 chars, fits in [u8; 64])
//    On-chain: terms_hash = SHA-256 of plaintext for verification

// For >2 parties: use a group key derived from all parties' keys,
// or encrypt separately for each party and store multiple URIs.
// V1: support 2-party private agreements only. Multi-party private = V2.
```

---

## Project Structure

```
agent-agreement-protocol/
├── Anchor.toml
├── Cargo.toml
├── programs/
│   └── aap/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── register_agent.rs
│           │   ├── update_delegation.rs
│           │   ├── register_sub_agent.rs
│           │   ├── revoke_agent.rs
│           │   ├── propose_agreement.rs
│           │   ├── add_party.rs
│           │   ├── sign_agreement.rs
│           │   ├── cancel_agreement.rs
│           │   ├── fulfill_agreement.rs
│           │   └── close_agreement.rs
│           ├── state/
│           │   ├── mod.rs
│           │   ├── agent_identity.rs
│           │   ├── agreement.rs
│           │   └── agreement_party.rs
│           ├── constants.rs
│           ├── errors.rs
│           └── events.rs
├── tests/
│   ├── setup.ts                 // Shared test helpers, keypair gen, airdrop
│   ├── 01_register_agent.ts
│   ├── 02_update_delegation.ts
│   ├── 03_register_sub_agent.ts
│   ├── 04_revoke_agent.ts
│   ├── 05_propose_agreement.ts
│   ├── 06_add_party.ts
│   ├── 07_sign_agreement.ts
│   ├── 08_cancel_agreement.ts
│   ├── 09_fulfill_agreement.ts
│   ├── 10_close_agreement.ts
│   └── 11_integration.ts       // Full flow: register -> propose -> sign -> fulfill -> close
├── sdk/
│   └── src/
│       ├── index.ts
│       ├── client.ts            // High-level AAP client wrapping Anchor
│       ├── crypto.ts            // ECDH + AES-256-GCM encryption helpers
│       ├── storage.ts           // Arweave upload/download via Irys
│       └── types.ts             // TypeScript types matching on-chain structs
└── README.md
```

---

## Implementation Plan (Step-by-Step for Claude Code)

### Phase 1: Scaffold & State (Day 1)

```
Step 1: Initialize Anchor project
  - anchor init agent-agreement-protocol
  - Set up Anchor.toml for devnet
  - Add Bankrun dev dependency for fast testing

Step 2: Define state structs
  - Create state/agent_identity.rs with AgentIdentity + DelegationScope
  - Create state/agreement.rs with Agreement
  - Create state/agreement_party.rs with AgreementParty
  - Create constants.rs with all u8 enum constants
  - Create errors.rs with custom error enum (InvalidScope, Unauthorized,
    AgreementExpired, AlreadySigned, InvalidStatus, MaxPartiesExceeded, etc.)
  - Create events.rs with event structs (AgentRegistered, AgreementProposed,
    AgreementSigned, AgreementActivated, AgreementFulfilled, AgreementCancelled)

Step 3: Write lib.rs entrypoint with all instruction function signatures
  - Just the function signatures returning Ok(()) — stubs
  - Ensures it compiles before any logic
```

### Phase 2: Agent Registry — TDD (Day 2)

```
Step 4: Write test 01_register_agent.ts FIRST
  - Test: authority registers agent → AgentIdentity PDA created with correct fields
  - Test: agent_key == authority → should fail
  - Test: expired scope → should fail
  - Then implement register_agent.rs to make tests pass

Step 5: Write test 02_update_delegation.ts FIRST
  - Test: authority updates scope → fields updated
  - Test: non-authority tries update → should fail
  - Then implement update_delegation.rs

Step 6: Write test 03_register_sub_agent.ts FIRST
  - Test: agent registers sub-agent → parent field set
  - Test: sub-agent tries to register sub-sub-agent → should fail (max 2 levels)
  - Test: sub-agent scope exceeds parent → should fail
  - Then implement register_sub_agent.rs

Step 7: Write test 04_revoke_agent.ts FIRST
  - Test: authority revokes → PDA closed, rent returned
  - Test: non-authority tries revoke → should fail
  - Then implement revoke_agent.rs
```

### Phase 3: Agreement Engine — TDD (Day 3-4)

```
Step 8: Write test 05_propose_agreement.ts FIRST
  - Test: agent proposes public agreement → Agreement PDA + proposer AgreementParty created
  - Test: agent proposes private agreement → visibility = 1, terms_uri set
  - Test: agent proposes with escrow → EscrowVault created, tokens deposited
  - Test: agent without can_sign_agreements → should fail
  - Test: expired delegation → should fail
  - Test: escrow exceeds max_commit_lamports → should fail
  - Then implement propose_agreement.rs

Step 9: Write test 06_add_party.ts FIRST
  - Test: proposer adds counterparty → AgreementParty PDA created
  - Test: non-proposer tries to add → should fail
  - Test: add more than num_parties → should fail
  - Test: add duplicate party → should fail
  - Then implement add_party.rs

Step 10: Write test 07_sign_agreement.ts FIRST
  - Test: counterparty signs → signed=true, signed_at set
  - Test: last party signs → Agreement.status becomes Active, event emitted
  - Test: sign with escrow → tokens deposited to vault
  - Test: already signed → should fail
  - Test: agreement expired → should fail
  - Test: sign cancelled agreement → should fail
  - Then implement sign_agreement.rs

Step 11: Write test 08_cancel_agreement.ts FIRST
  - Test: proposer cancels → status=Cancelled, escrow returned
  - Test: proposer's authority cancels → should succeed
  - Test: cancel Active agreement → should fail
  - Test: non-proposer cancels → should fail
  - Then implement cancel_agreement.rs

Step 12: Write test 09_fulfill_agreement.ts FIRST
  - Test: all parties mark fulfilled → status=Fulfilled, escrow distributed
  - Test: fulfill non-Active agreement → should fail
  - Test: escrow distribution doesn't sum to total → should fail
  - Then implement fulfill_agreement.rs

Step 13: Write test 10_close_agreement.ts FIRST
  - Test: close Fulfilled agreement → all PDAs closed, rent returned
  - Test: close Active agreement → should fail
  - Then implement close_agreement.rs
```

### Phase 4: Integration Tests (Day 5)

```
Step 14: Write 11_integration.ts
  Full happy-path flows:

  Flow 1: Public agreement without escrow
    register agent A → register agent B → propose → add party B →
    B signs → status=Active → both fulfill → close → all rent reclaimed

  Flow 2: Private agreement with USDC escrow
    register agent A → register agent B → propose(visibility=private, escrow=100 USDC) →
    add party B → B signs(escrow=100 USDC) → status=Active →
    fulfill(distribution: A=150, B=50) → close

  Flow 3: Cancel flow
    propose → add party → cancel → escrow returned → close

  Flow 4: Sub-agent signing
    register agent A → A registers sub-agent A' →
    register agent B → A' proposes agreement → B signs → Active

  Flow 5: Delegation expiry
    register agent with expires_at = now + 5 sec →
    wait 6 sec → try propose → should fail
```

### Phase 5: SDK (Day 6)

```
Step 15: Build TypeScript SDK
  - client.ts: AAPClient class wrapping all instructions with ergonomic methods
    - registerAgent(authority, agentKey, metadata, scope)
    - proposeAgreement(agentKey, params) → { agreementPDA, partyPDA }
    - signAgreement(agentKey, agreementId, escrowAmount?)
    - fulfillAgreement(agentKey, agreementId, distribution)
    - etc.

  - crypto.ts: (V1 — 2-party private only)
    - deriveSharedSecret(myEd25519Private, theirEd25519Public) → sharedKey
    - encryptTerms(sharedKey, plaintext) → { ciphertext, nonce }
    - decryptTerms(sharedKey, ciphertext, nonce) → plaintext
    - hashTerms(plaintext) → [u8; 32]

  - storage.ts:
    - uploadEncryptedTerms(ciphertext, nonce) → arweave_tx_id
    - downloadEncryptedTerms(arweave_tx_id) → { ciphertext, nonce }

  - types.ts: All TypeScript interfaces matching on-chain structs
```

### Phase 6: Devnet Deploy & Smoke Test (Day 7)

```
Step 16: Deploy to devnet
  - anchor build
  - anchor deploy --provider.cluster devnet
  - Run integration tests against devnet
  - Verify PDAs on Solana Explorer

Step 17: Manual walkthrough
  - Use SDK to register two agents
  - Propose, sign, and fulfill a public agreement
  - Propose, sign, and fulfill a private agreement (verify encryption round-trip)
  - Verify all rent is reclaimed on close
```

---

## Rent Cost Summary

| Account | Size (bytes) | Rent (SOL) | Lifecycle |
|---------|-------------|------------|-----------|
| AgentIdentity | 156 | ~0.00144 | Persistent (until revoked) |
| Agreement | 246 | ~0.00226 | Closed after fulfillment/cancel |
| AgreementParty | 91 | ~0.00089 | Closed with Agreement |
| EscrowVault (TokenAccount) | 165 | ~0.00203 | Closed with Agreement |

**Cost per 2-party agreement with escrow**: ~0.00607 SOL (~$0.90 at $150/SOL), fully reclaimable.

**Cost per 2-party agreement without escrow**: ~0.00404 SOL (~$0.60), fully reclaimable.

---

## V2 Roadmap (Out of Scope for V1)

- Conditional execution engine (on-chain condition checking + auto-fulfillment)
- Entity formation module (DAO LLC trigger, governance token minting)
- Crafts CPI for token launches
- Reputation scoring (fulfilled/breached ratio)
- MCP server for agent framework integration
- Multi-party private agreements (group encryption)
- Dispute resolution with arbitrator role
- Clockwork/automation for condition cranking

# Agent Agreement Protocol (AAP) — Development Guide

## Overview

The Agent Agreement Protocol is a Solana program suite that enables **AI agents to register identities and form binding agreements on-chain**, with human oversight through delegation scopes.

Two implementations exist side by side:

| | V1 (Standard PDAs) | V2 (Compressed PDAs) |
|---|---|---|
| Program | `agent-agreement-protocol` | `aap-compressed` |
| Program ID | `BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ` | `Ey56W7XXaeLm2kYNt5Ewp6TfgWgpVEZ2DD23ernmfuxY` |
| Network | Devnet | Devnet |
| Framework | Anchor 0.30.1 | Anchor 0.31.1 + Light SDK 0.18.0 |
| Storage cost | ~$0.60–0.90 per 2-party agreement (rent) | Near zero (ZK compressed Merkle trees) |
| Escrow support | Yes (SPL token vaults) | No (compressed accounts can't hold tokens) |
| Test runner | Surfpool + ts-mocha | `cargo test-sbf` + Light prover |

## Architecture

### State Accounts

**AgentIdentity** — Represents an AI agent registered by a human authority.
- `authority` — human owner (Pubkey)
- `agent_key` — agent's signing keypair (Pubkey)
- `metadata_hash` — SHA-256 of off-chain metadata JSON
- `scope` — delegation permissions (can_sign_agreements, can_commit_funds, max_commit_lamports, expires_at)
- `parent` — parent agent for sub-agent hierarchies (max 2 levels)

**Agreement** — A multi-party agreement proposed by an agent.
- `agreement_id` — 16-byte UUID
- `agreement_type` — Safe (0), Service (1), Revenue Share (2), Joint Venture (3), Custom (4)
- `status` — Proposed (0) → Active (1) → Fulfilled (2) / Breached (3) / Disputed (4) / Cancelled (5)
- `proposer` — AgentIdentity that created the agreement
- `terms_hash` / `terms_uri` — content-addressed terms document
- `num_parties` / `num_signed` / `parties_added` — party tracking
- V1 only: `escrow_vault`, `escrow_mint`, `escrow_total`

**AgentVault** — PDA-based SOL vault for an agent (V1 only).
- `agent_identity` — the linked AgentIdentity PDA
- `authority` — human owner
- `balance` — current SOL balance in lamports
- Seeds: `["vault", agent_identity]`

**AgreementParty** — Links an agent to an agreement with a role.
- `agreement` — parent Agreement
- `agent_identity` — the party's AgentIdentity
- `role` — Proposer (0), Counterparty (1), Witness (2), Arbitrator (3)
- `signed` / `signed_at` — signing state
- V1 only: `escrow_deposited`

### PDA Seeds

| Account | Seeds |
|---|---|
| AgentIdentity | `["agent", agent_key]` |
| Agreement | `["agreement", agreement_id]` |
| AgreementParty | `["party", agreement_id, agent_identity_address]` |

### Instructions

**V1 has 12 instructions (V2 has 10 — no vault):**

**Identity Management:**
1. `register_agent` — Register a new agent identity (authority + agent keypair)
2. `update_delegation` — Modify agent's delegation scope
3. `register_sub_agent` — Create a child agent under a parent (max depth 2)
4. `revoke_agent` — Revoke agent and close the identity account

**Agreement Lifecycle:**
5. `propose_agreement` — Create agreement + auto-add proposer as first party (auto-signed)
6. `add_party` — Proposer adds another agent as a party (role assigned)
7. `sign_agreement` — Party signs; agreement becomes Active when all parties sign
8. `cancel_agreement` — Proposer cancels a Proposed agreement
9. `fulfill_agreement` — Any party marks an Active agreement as Fulfilled
10. `close_agreement` — Authority closes a terminal agreement (Fulfilled/Cancelled/Breached)

**Vault (V1 only):**
11. `deposit_to_vault` — Human deposits SOL into agent's PDA vault
12. `withdraw_from_vault` — Agent withdraws SOL from vault (within max_commit_lamports)

### Agreement State Machine

```
propose_agreement          All parties sign         fulfill / breach
    ┌──────┐    add_party    ┌────────┐              ┌───────────┐
    │PROPOSED│──────────────→│ ACTIVE │─────────────→│ FULFILLED │
    └──┬───┘    sign         └────────┘              └─────┬─────┘
       │                         │                         │
       │ cancel                  │ (external)         close_agreement
       ▼                         ▼                         ▼
  ┌──────────┐            ┌──────────┐              (account closed)
  │CANCELLED │            │ BREACHED │
  └──────────┘            └──────────┘
```

## Project Structure

```
agent-agreement-protocol/
├── Anchor.toml                     # Program IDs, cluster config
├── Cargo.toml                      # Workspace root
├── aap-v1-architecture.md          # Original design document
├── DEVELOPMENT.md                  # This file
├── README.md                       # Project overview for judges/users
├── programs/
│   ├── agent-agreement-protocol/   # V1 — Standard Anchor PDAs
│   │   └── src/
│   │       ├── lib.rs              # Program entrypoint (12 instructions)
│   │       ├── constants.rs        # Status/role/type enums as u8
│   │       ├── errors.rs           # AapError enum
│   │       ├── events.rs           # Event structs
│   │       ├── instructions/       # 12 instruction handlers (incl. vault)
│   │       └── state/              # AgentIdentity, AgentVault, Agreement, AgreementParty
│   └── aap-compressed/            # V2 — Light Protocol compressed accounts
│       ├── src/
│       │   ├── lib.rs              # Program entrypoint + Light CPI signer
│       │   ├── constants.rs        # Same constants as V1
│       │   ├── errors.rs           # AapError (no escrow/vault errors)
│       │   ├── instructions/       # 10 handlers, adapted for compressed accounts
│       │   └── state/              # Compressed versions (no rent, no bump, no escrow)
│       └── tests/test.rs           # Integration tests (cargo test-sbf)
├── frontend/                       # Next.js 14 DocuSign-like explorer (see frontend/README.md)
├── sdk/                            # TypeScript SDK (see sdk/README.md)
├── api/                            # REST API wrapper (see api/README.md)
├── skill/                          # OpenClaw agent skill
├── scripts/seed-devnet.ts          # Devnet seed data script
├── clients/ts/                     # Codama-generated TypeScript client
├── content/                        # Marketing: X content plan, video storyboard
└── tests/
    └── agent-agreement-protocol.ts # V1 TypeScript integration tests (Surfpool)
```

## Testing Guide

### Prerequisites

```bash
# Solana CLI + Agave validator
solana --version       # Should be 2.x+

# Anchor CLI
anchor --version       # 0.32.x

# Rust toolchain (pinned in rust-toolchain.toml)
rustc --version        # 1.89.0

# Light Protocol CLI (V2 only)
npm i -g @lightprotocol/zk-compression-cli@0.27.1-alpha.2

# Node.js (V1 TypeScript tests)
node --version         # 18+
```

### Running V1 Tests (Surfpool)

V1 tests use TypeScript with ts-mocha, running against Surfpool (local Solana test environment).

```bash
# Start Surfpool (in a separate terminal)
surfpool

# Build the program
anchor build

# Run all 27 V1 tests
anchor test --skip-local-validator
```

### Running V2 Tests (Light Protocol)

V2 tests use Rust with `cargo test-sbf` and require the Light Protocol prover.

```bash
# 1. Start the ZK prover (in a separate terminal)
light start-prover
# Wait for health check: curl http://localhost:3001/health → {"status":"ok"}

# 2. Build the program (SBF target)
cd programs/aap-compressed
cargo build-sbf

# 3. Run all 7 tests (4 unit + 3 integration)
cargo test-sbf

# Run a specific test with output
cargo test-sbf -- test_agreement_lifecycle --nocapture
```

**V2 Test Coverage:**

| Test | What it covers |
|---|---|
| `test_register_update_revoke_agent` | register → update delegation → revoke (close) |
| `test_agreement_lifecycle` | propose → add_party → sign → fulfill → close |
| `test_cancel_agreement` | propose → cancel |

### Building Only

```bash
# Build both programs
anchor build

# Build V2 only (SBF)
cargo build-sbf --manifest-path programs/aap-compressed/Cargo.toml
```

## V2 (Light Protocol) Technical Notes

### Key Differences from V1

- **No `#[account]` macro** — Uses `LightDiscriminator` + `AnchorSerialize`/`AnchorDeserialize`
- **No PDAs** — Addresses derived via `light_sdk::address::v2::derive_address(seeds, tree_pubkey, program_id)`
- **No rent** — State stored as leaves in shared Merkle trees
- **LightAccount wrappers** — `new_init()` (create), `new_mut()` (read/update pass-through), `new_close()` (nullify)
- **CPI pattern** — `LightSystemProgramCpi::new_cpi(SIGNER, proof).with_light_account(...).invoke(cpi_accounts)`
- **Validity proofs** — Client fetches ZK proofs covering all accounts in a transaction via `get_validity_proof(hashes, addresses, ...)`

### Stack Overflow Prevention

SBF enforces a 4096-byte stack frame limit. Light Protocol structs are large, so split handlers into `#[inline(never)]` sub-functions:

```rust
pub fn handler(...) -> Result<()> {
    // Validation logic here
    build_and_invoke(...)  // Separate stack frame
}

#[inline(never)]
fn build_and_invoke(...) -> Result<()> {
    // Create LightAccounts + CPI call
}
```

### Multi-Account Proofs

For instructions that touch multiple compressed accounts, pass all hashes and addresses in a single `get_validity_proof` call:

```rust
// add_party: 3 existing accounts + 1 new address
let rpc_result = rpc.get_validity_proof(
    vec![proposer_hash, agreement_hash, party_identity_hash],  // state
    vec![AddressWithTree { tree, address: new_party_address }], // addresses
    None,
).await?.value;

// The order of packed_tree_infos matches the order of hashes
let state_trees = rpc_result.pack_tree_infos(&mut remaining_accounts).state_trees.unwrap();
// state_trees.packed_tree_infos[0] → proposer
// state_trees.packed_tree_infos[1] → agreement
// state_trees.packed_tree_infos[2] → party_identity
```

### Anchor 0.31.x Quirks

- The `#[program]` macro requires glob re-exports (`pub use instructions::*`) at crate root — it generates `__client_accounts_*` types that must be accessible.
- Multiple glob re-exports cause `ambiguous_glob_reexports` warnings — suppress with `#[allow(ambiguous_glob_reexports)]`.

### Test Environment Caveats

- `Clock::get()?.unix_timestamp` returns 0 in the test validator — don't assert `> 0` for timestamps
- In V2 batched trees, account nullification (close) is queued — the indexer may still return the account briefly after closing
- Agent keypairs used as signers must have SOL (`rpc.airdrop_lamports(...)`) since the Light system program charges fees to the `signer` account

## Development Workflow

1. **Read the architecture doc** — `aap-v1-architecture.md` contains the full specification
2. **Make changes** — Edit instruction handlers in `programs/*/src/instructions/`
3. **Build** — `anchor build` or `cargo build-sbf`
4. **Test locally** — Run the relevant test suite (V1: `anchor test`, V2: `cargo test-sbf`)
5. **Commit** — Small, focused commits with clear messages

### Adding a New Instruction

1. Create handler in `src/instructions/new_instruction.rs`
2. Add `pub mod new_instruction;` to `src/instructions/mod.rs`
3. Add `pub use instructions::new_instruction::*;` to `src/lib.rs`
4. Add the instruction entry in the `#[program]` module in `src/lib.rs`
5. Write a test helper + test case
6. For V2: watch for stack overflow warnings and split into `#[inline(never)]` functions if needed

### Common Error Codes (V2 / Light Protocol)

| Code | Hex | Meaning |
|---|---|---|
| 6002 | 0x1772 | Unauthorized — signer doesn't match expected key |
| 6041 | 0x1799 | AddressMerkleTreeAccountDiscriminatorMismatch — wrong CLI version |
| 6042 | 0x179a | StateMerkleTreeAccountDiscriminatorMismatch |
| 6043 | 0x179b | ProofVerificationFailed — stale proof or wrong prover version |

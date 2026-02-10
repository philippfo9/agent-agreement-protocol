# Agent Agreement Protocol (AAP)

**On-chain identity and agreement infrastructure for AI agents on Solana.**

AAP is the legal layer for the agent economy. Agents register verifiable identities anchored to human authority, then propose, sign, and execute agreements — with optional escrow and document attachments — all on-chain.

> **Colosseum Agent Hackathon** — Built by [kurtloopfo](https://agents.colosseum.com) 🔮

**Live:** [frontend-ten-livid-87.vercel.app](https://frontend-ten-livid-87.vercel.app)

## Why This Matters

Agents are getting wallets, trading, and deploying contracts. But there's no standard way for agents to:

- **Identify themselves** on-chain with verifiable human authority
- **Enter agreements** with other agents or humans (service contracts, NDAs, revenue shares, SAFEs)
- **Commit funds** with cryptographic guarantees via escrow vaults
- **Scope delegation** — define what an agent can and can't do, with time-bound expiry

AAP solves all four. Every agent action traces back to a human. Humans retain full control.

## Architecture

```
Human Authority (wallet)
    │
    ├── Agent Identity (PDA)          ← on-chain, scoped delegation
    │       ├── can_sign_agreements
    │       ├── can_commit_funds
    │       ├── max_commit_lamports
    │       └── expires_at
    │
    ├── Agent Vault (PDA)             ← SOL escrow, human deposits/agent draws
    │
    └── Sub-Agent Identity (PDA)      ← max 2 levels deep
            └── scope ≤ parent scope

Agent A ──── Agreement (PDA) ──── Agent B
                  │
                  ├── terms_hash (SHA-256)
                  ├── terms_uri (Arweave / R2)
                  ├── escrow per party
                  ├── document attachment (R2 + hash on-chain)
                  ├── status: Proposed → Active → Fulfilled
                  └── parties[2-8]: Proposer, Counterparty, Witness, Arbitrator
```

## Features

### On-Chain Program (Anchor, V1)
- **Agent Identity Registry** — Register agents with scoped delegation from human authority
- **Sub-agent Hierarchy** — Agents can register sub-agents (max 2 levels, scope inheritance)
- **Agreement Engine** — Propose, add parties (2-8), sign, fulfill, cancel, close
- **Agent Vault** — PDA-based SOL vault: human deposits, agent withdraws within limits
- **Escrow Support** — Optional per-party SPL token escrow
- **12 instructions**, 4 account types, full event emission

### Compressed Accounts (V2, Light Protocol)
- **100x cost reduction** via ZK-compressed state
- Same semantics, massive scale potential

### Frontend: DocuSign for Solana
- **Agreement Templates** — NDA, Service, Revenue Share, Joint Venture, Freelance
- **Document Upload** — PDF/image upload to R2 with SHA-256 hash anchored on-chain
- **Multi-party Signing** — Visual signature blocks with cursive name display
- **Claim Flow** — Agent generates keypair → sends URL → human claims + sets delegation scopes
- **Agent Profiles** — Public trust surface with identity, scope, agreement history
- **Vault Management** — Deposit/withdraw SOL via on-chain vault
- **Emergency Controls** — One-click revoke, cancel, withdraw
- **Privacy** — Private agreements gated by wallet signature verification
- **Dark/Light Theme** — Monochrome design, responsive

### API Layer (tRPC + REST)
- **tRPC** — End-to-end type-safe API with wallet signature auth middleware
- **REST API** — HTTP wrapper returning unsigned transactions for agents
- **Wallet Auth** — Ed25519 signature verification (tweetnacl) for private data access

### SDK & Skill
- **TypeScript SDK** — `AAPClient` class wrapping all 12 instructions + read helpers
- **OpenClaw Skill** — Any AI agent can learn to use AAP via the skill file

## Program IDs

| Program | Network | ID |
|---------|---------|-----|
| AAP V1 | Devnet | `BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ` |
| AAP V2 (Compressed) | Devnet | `Ey56W7XXaeLm2kYNt5Ewp6TfgWgpVEZ2DD23ernmfuxY` |

## Instructions (V1)

### Agent Registry
| Instruction | Description |
|------------|-------------|
| `register_agent` | Register agent identity with scoped delegation |
| `update_delegation` | Update agent's delegation scope |
| `register_sub_agent` | Register a sub-agent under existing agent |
| `revoke_agent` | Revoke agent, close PDA, reclaim rent |

### Agreement Engine
| Instruction | Description |
|------------|-------------|
| `propose_agreement` | Create agreement + auto-sign as proposer |
| `add_party` | Add counterparty/witness/arbitrator (up to 8 parties) |
| `sign_agreement` | Sign as party, auto-activate when all signed |
| `cancel_agreement` | Cancel proposed agreement, return escrow |
| `fulfill_agreement` | Mark as fulfilled when complete |
| `close_agreement` | Close all PDAs, reclaim all rent |

### Vault
| Instruction | Description |
|------------|-------------|
| `deposit_to_vault` | Human deposits SOL into agent's PDA vault |
| `withdraw_from_vault` | Agent withdraws SOL from vault (within limits) |

## Cost

| Account | Size | Rent (SOL) |
|---------|------|-----------|
| AgentIdentity | 156 bytes | ~0.00144 |
| AgentVault | ~96 bytes | ~0.00089 |
| Agreement | 248 bytes | ~0.00228 |
| AgreementParty | 91 bytes | ~0.00089 |

**2-party agreement with vault: ~0.006 SOL (~$0.90), fully reclaimable.**

## Quick Start

### Build & Test

```bash
yarn install
anchor build
anchor test --skip-local-validator  # requires Surfpool running
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### For AI Agents

Read the [skill file](./skill/SKILL.md) — it teaches any agent how to register, propose agreements, and interact with the protocol.

## Project Structure

```
├── programs/
│   ├── agent-agreement-protocol/     # V1 — Anchor program (12 instructions)
│   │   └── src/
│   │       ├── instructions/          # 12 instruction handlers
│   │       ├── state/                 # AgentIdentity, AgentVault, Agreement, AgreementParty
│   │       ├── constants.rs
│   │       ├── errors.rs
│   │       └── events.rs
│   └── aap-compressed/               # V2 — Light Protocol compressed
├── frontend/                          # Next.js 14 — DocuSign-like explorer
│   ├── src/
│   │   ├── app/                       # Pages: home, explore, agreements, claim, agent, emergency
│   │   ├── components/                # UI: cards, forms, vault, signatures, documents
│   │   ├── lib/                       # Hooks, types, auth, tRPC client, templates
│   │   └── server/trpc/              # tRPC router + wallet auth context
│   └── prisma/                        # Schema for off-chain metadata (Neon Postgres)
├── sdk/                               # TypeScript SDK (@aap/sdk)
├── api/                               # REST API (unsigned transaction builder)
├── skill/                             # OpenClaw/Claude agent skill
├── scripts/                           # Devnet seed data
├── tests/                             # Integration tests
├── content/                           # Marketing: X content plan, video storyboard
└── clients/ts/                        # Codama-generated TypeScript client
```

## Tech Stack

- **Anchor** 0.30.x — Solana program framework
- **Light Protocol** — ZK-compressed accounts (V2)
- **Next.js 14** — Frontend (App Router, TypeScript, Tailwind)
- **tRPC v11** — End-to-end type-safe API
- **Prisma + Neon** — Off-chain metadata (documents, signer profiles, privacy)
- **Cloudflare R2** — Document storage with SHA-256 verification
- **tweetnacl** — Ed25519 wallet signature verification
- **SWR** — Client-side on-chain data fetching
- **Solana Wallet Adapter** — Phantom, Solflare
- **Surfpool** — Local Solana testing

## Design Principles

1. **Minimal PDAs** — Fixed-size structs, no Vecs, packed fields. Every byte costs rent.
2. **Humans retain control** — Every agent traces to a human authority. Agents cannot escalate.
3. **Scoped delegation** — Agents operate within defined budgets, permissions, and time bounds.
4. **On-chain for truth, off-chain for UX** — Agreement state lives on Solana; documents and display names in Postgres/R2.
5. **Reclaimable rent** — Close accounts when done. Net cost approaches zero.
6. **Type-safe end-to-end** — tRPC from frontend to API, Anchor IDL for on-chain.

## Roadmap (Post-Hackathon)

- [ ] Conditional execution engine (auto-fulfillment based on on-chain conditions)
- [ ] MCP Server for agent framework integration
- [ ] Reputation scoring (fulfilled/breached ratio)
- [ ] Dispute resolution with arbitrator workflows
- [ ] Mainnet deployment
- [ ] Entity formation module (DAO LLC, governance tokens)

## License

MIT

---

Built with 🔮 by [kurtloopfo](https://agents.colosseum.com) for the Colosseum Agent Hackathon.

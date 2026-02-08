# Agent Agreement Protocol (AAP)

**On-chain identity and agreement infrastructure for AI agents on Solana.**

AAP is the legal layer for the agent economy. It lets agents register verifiable identities anchored to human authority, then propose, sign, and execute bilateral or multilateral agreements — with optional escrow — all on-chain.

> **Colosseum Agent Hackathon** — Built by [kurtloopfo](https://colosseum.com/agent-hackathon) 🔮

## Why This Matters

Agents are getting wallets, trading, and deploying contracts. But there's no standard way for agents to:

- **Identify themselves** on-chain with verifiable human authority
- **Enter agreements** with other agents (service contracts, revenue shares, SAFEs)
- **Commit funds** with cryptographic guarantees via escrow
- **Scope delegation** — define what an agent can and can't do

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
    └── Sub-Agent Identity (PDA)      ← max 2 levels deep
            └── scope ≤ parent scope

Agent A ──── Agreement (PDA) ──── Agent B
                  │
                  ├── terms_hash (SHA-256)
                  ├── terms_uri (Arweave)
                  ├── escrow_vault (SPL Token)
                  ├── status: Proposed → Active → Fulfilled
                  └── parties: Proposer, Counterparty, Witness, Arbitrator
```

## Features

### V1: Core Protocol (Anchor)
- **Agent Identity Registry** — Register agents with scoped delegation from human authority
- **Sub-agent Hierarchy** — Agents can register sub-agents (max 2 levels, scope inheritance)
- **Agreement Engine** — Propose, add parties, sign, fulfill, cancel, close
- **Escrow Support** — Optional SPL token escrow with per-party deposits
- **Private Agreements** — ECDH encrypted terms (Ed25519 → X25519 + AES-256-GCM)
- **Event Emission** — All state changes emit events for indexing
- **27 tests passing** — Full lifecycle coverage on Surfpool/Bankrun

### V2: Compressed Accounts (Light Protocol)
- **100x cost reduction** via ZK-compressed state
- Same semantics, massive scale

### Frontend: Protocol Explorer
- **My Agents** — Register, scope, and manage agent identities
- **Agreement Feed** — Real-time view of all agreements
- **Agent Profile** — Public trust surface (`/agent/{pubkey}`)
- **Emergency Controls** — One-click revoke, cancel, withdraw

### SDK & API
- **TypeScript SDK** — `AAPClient` class wrapping all instructions
- **REST API** — HTTP wrapper for agents without direct Solana access
- **OpenClaw Skill** — Any AI agent can learn to use AAP

## Cost

| Account | Size | Rent (SOL) | Lifecycle |
|---------|------|-----------|-----------|
| AgentIdentity | 156 bytes | ~0.00144 | Persistent (until revoked) |
| Agreement | 248 bytes | ~0.00228 | Closed after fulfillment |
| AgreementParty | 91 bytes | ~0.00089 | Closed with Agreement |
| EscrowVault | 165 bytes | ~0.00203 | Closed with Agreement |

**2-party agreement with escrow: ~0.006 SOL (~$0.90), fully reclaimable.**

## Quick Start

### Build & Test

```bash
# Install dependencies
yarn install

# Build the program
anchor build

# Run tests (27 passing)
anchor test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### For AI Agents

Read the [skill file](./skill/SKILL.md) — it teaches any agent how to register an identity, propose agreements, and interact with the protocol.

## Program IDs

| Program | ID |
|---------|-----|
| AAP V1 | `4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe` |
| AAP V2 (Compressed) | `CmPr5AEFxgHVZnDAbPr5RCDHm8d7bJjhXDqRTmFSCVkW` |

## Instructions

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
| `add_party` | Add counterparty/witness/arbitrator |
| `sign_agreement` | Sign as party, auto-activate when all signed |
| `cancel_agreement` | Cancel proposed agreement, return escrow |
| `fulfill_agreement` | Mark as fulfilled when complete |
| `close_agreement` | Close all PDAs, reclaim all rent |

## Project Structure

```
├── programs/
│   ├── agent-agreement-protocol/   # V1 — Core Anchor program
│   │   └── src/
│   │       ├── instructions/        # 10 instruction handlers
│   │       ├── state/               # AgentIdentity, Agreement, AgreementParty
│   │       ├── constants.rs
│   │       ├── errors.rs
│   │       └── events.rs
│   └── aap-compressed/             # V2 — Light Protocol compressed
├── tests/                           # 27 tests, full lifecycle coverage
├── frontend/                        # Next.js protocol explorer
├── skill/                           # OpenClaw/Claude skill
├── api/                             # REST API wrapper
├── sdk/                             # TypeScript SDK
└── migrations/
```

## Design Principles

1. **Minimal PDAs** — Fixed-size structs, no Vecs, packed fields. Every byte costs rent.
2. **Humans retain control** — Every agent traces to a human authority. Agents cannot escalate.
3. **Scoped delegation** — Agents operate within defined budgets, permissions, and time bounds.
4. **Reclaimable rent** — Close accounts when done. Net cost approaches zero.
5. **Test-driven** — Every instruction has tests. No code lands without passing tests.

## Use Cases

- **Service Agreements** — Agent A hires Agent B for a task with escrowed payment
- **Revenue Sharing** — Agents split income from a joint operation
- **SAFEs** — Equity-like agreements for agent-run ventures
- **Data Licensing** — Agents pay for proprietary data feeds with delivery guarantees
- **Multi-Agent Coordination** — Witnesses and arbitrators for complex deals

## Tech Stack

- **Anchor** 0.30.x — Solana program framework
- **Light Protocol** — ZK-compressed accounts (V2)
- **Next.js 14** — Frontend (App Router, TypeScript, Tailwind)
- **SWR** — Client-side data fetching with dedup
- **Solana Wallet Adapter** — Phantom, Solflare support

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

Built with 🔮 by [kurtloopfo](https://colosseum.com/agent-hackathon) for the Colosseum Agent Hackathon.

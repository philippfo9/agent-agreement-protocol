# Contributing to Agent Agreement Protocol

Thanks for your interest in AAP. Here's how to get set up and contribute.

## Prerequisites

- **Rust** 1.89+ (pinned in `rust-toolchain.toml`)
- **Solana CLI** 2.x+ (`solana --version`)
- **Anchor CLI** 0.30.x (`anchor --version`)
- **Node.js** 18+ (`node --version`)
- **Surfpool** — Local Solana test environment ([install](https://github.com/txtx/surfpool))

For V2 (compressed accounts) only:
- **Light Protocol CLI** (`npm i -g @lightprotocol/zk-compression-cli@0.27.1-alpha.2`)

## Getting Started

```bash
# Clone
git clone https://github.com/philippfo9/agent-agreement-protocol.git
cd agent-agreement-protocol

# Install dependencies
yarn install

# Build programs
anchor build

# Run V1 tests (start Surfpool first in another terminal)
surfpool
anchor test --skip-local-validator

# Run V2 tests
light start-prover  # in another terminal
cd programs/aap-compressed && cargo test-sbf
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Add DATABASE_URL + R2 credentials
npx prisma generate
npx prisma db push
npm run dev
```

## Repository Structure

| Directory | What | Language |
|-----------|------|---------|
| `programs/agent-agreement-protocol/` | V1 Anchor program (12 instructions) | Rust |
| `programs/aap-compressed/` | V2 Light Protocol program | Rust |
| `frontend/` | Next.js 14 explorer + tRPC API | TypeScript |
| `sdk/` | TypeScript SDK (`AAPClient`) | TypeScript |
| `api/` | REST API (unsigned tx builder) | TypeScript |
| `skill/` | OpenClaw agent skill | Markdown |
| `tests/` | V1 integration tests | TypeScript |
| `scripts/` | Devnet seed data | TypeScript |

## Development Workflow

1. **Read the docs** — `DEVELOPMENT.md` for architecture, `aap-v1-architecture.md` for the original spec
2. **Make changes** — One concern per commit
3. **Test** — All tests must pass before PR
4. **Commit** — Small, focused commits with clear messages

### Adding a New Instruction (Anchor V1)

1. Create `src/instructions/new_instruction.rs`
2. Export from `src/instructions/mod.rs`
3. Re-export from `src/lib.rs`
4. Add entrypoint in `#[program]` module
5. Add error variants to `src/errors.rs` if needed
6. Add events to `src/events.rs`
7. Write test in `tests/agent-agreement-protocol.ts`
8. Update IDL in `frontend/src/lib/idl.ts`

### Frontend Changes

- Follow rules in `frontend/CLAUDE.md` (60 Vercel React best practices)
- On-chain reads → SWR hooks in `lib/hooks.ts`
- Off-chain data → tRPC procedures in `server/trpc/router.ts`
- No `useEffect` for data fetching — use SWR or tRPC
- Dark monochrome theme — black/grey/white only

## Key Constraints

- **Program signer = agent_key** — `proposer_identity.agent_key == proposer_signer.key()`. The signer must be the agent's keypair, not the authority wallet.
- **Fixed-size structs** — No Vecs on-chain. Everything is fixed-size for predictable rent.
- **Max 8 parties** — Agreement `num_parties` capped at 8.
- **Max 2-level hierarchy** — Agent → Sub-agent (no deeper nesting).
- **init-if-needed for vault** — `AgentVault` uses `init_if_needed` feature.

## Program IDs

| Program | Devnet |
|---------|--------|
| AAP V1 | `BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ` |
| AAP V2 | `Ey56W7XXaeLm2kYNt5Ewp6TfgWgpVEZ2DD23ernmfuxY` |

## Code Style

- **Rust:** Standard `rustfmt`, no `unsafe`, explicit error handling
- **TypeScript:** Strict mode, no `any` (except Anchor provider workarounds), Prettier defaults
- **Commits:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)

## License

MIT — see [LICENSE](./LICENSE).

# AAP Frontend — Agent Agreement Protocol

Dark-themed Next.js 14 dashboard for managing on-chain agent identities and agreements on Solana.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (dark theme)
- **@solana/wallet-adapter-react** (Phantom, Solflare)
- **@coral-xyz/anchor** (PDA deserialization)

## Views

| Route | Description |
|-------|-------------|
| `/` | **My Agents** — Register agents, set delegation scopes, view agent tree |
| `/agreements` | **Agreement Feed** — Real-time feed of agreements for connected wallet's agents |
| `/agent/[pubkey]` | **Agent Profile** — Public page showing identity, scope, agreement stats |
| `/emergency` | **Emergency Controls** — Revoke agents, cancel agreements (danger zone) |

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

- **Program ID**: `4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe` (from Anchor.toml)
- **Network switcher**: Toggle devnet/mainnet in the top-right navbar
- **Wallet**: Connect via Phantom or Solflare

## On-Chain Data

All data is read directly from Solana PDAs via Anchor:

- `AgentIdentity` PDA: `[b"agent", agent_pubkey]`
- `Agreement` PDA: `[b"agreement", agreement_id]`
- `AgreementParty` PDA: `[b"party", agreement_id, agent_identity]`

The "My Agents" view filters `AgentIdentity` PDAs where `authority == connected wallet`.
The "Agreement Feed" finds `AgreementParty` PDAs for the user's agents, then fetches the linked `Agreement` PDAs.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with Providers + Navbar
│   ├── page.tsx            # My Agents (/)
│   ├── globals.css         # Tailwind + wallet adapter overrides
│   ├── agreements/
│   │   └── page.tsx        # Agreement Feed
│   ├── agent/[pubkey]/
│   │   └── page.tsx        # Agent Profile
│   └── emergency/
│       └── page.tsx        # Emergency Controls
├── components/
│   ├── Providers.tsx       # Wallet + Network context providers
│   ├── Navbar.tsx          # Top navigation + network switcher
│   ├── AgentCard.tsx       # Agent identity card component
│   ├── AgreementCard.tsx   # Agreement display card
│   ├── RegisterAgentForm.tsx # New agent registration form
│   ├── StatusBadge.tsx     # Agreement status pill
│   └── Loading.tsx         # Loading + empty state components
└── lib/
    ├── constants.ts        # Program ID, labels, colors, networks
    ├── idl.ts              # Minimal Anchor IDL for account deserialization
    ├── types.ts            # TypeScript types matching on-chain structs
    ├── program.ts          # Anchor program helpers (fetch, query)
    ├── pda.ts              # PDA derivation helpers
    ├── network.ts          # Network context (devnet/mainnet)
    └── utils.ts            # Formatting utilities
```

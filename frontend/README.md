# AAP Frontend — DocuSign for Solana

Next.js 14 dashboard for on-chain agent identity and agreement management. Dark monochrome theme, responsive, wallet-first.

## Stack

- **Next.js 14** (App Router, Server Components)
- **TypeScript** (strict)
- **Tailwind CSS** (dark/light theme)
- **tRPC v11** — End-to-end type-safe API with wallet signature auth
- **Prisma + Neon Postgres** — Off-chain metadata (documents, signer names, privacy)
- **Cloudflare R2** — Document storage (PDF, images)
- **@solana/wallet-adapter-react** (Phantom, Solflare)
- **@coral-xyz/anchor** (on-chain PDA reads/writes)
- **SWR** — On-chain data fetching with dedup + auto-refresh

## Pages

| Route | Description |
|-------|-------------|
| `/` | **Home** — Agent/Human tabs, quick start, claim flow explanation |
| `/explore` | **Explore** — Public agreement feed + agent directory |
| `/agreements` | **My Agreements** — Agreements for connected wallet's agents |
| `/agreements/new` | **Propose Agreement** — Template selector, document upload, multi-party, privacy toggle |
| `/agreement/[id]` | **Agreement Detail** — Timeline, parties, signature blocks, document viewer, sign action |
| `/agent/[pubkey]` | **Agent Profile** — Public trust surface: identity, scope, agreements, vault |
| `/claim/[agentPubkey]` | **Claim Agent** — Agent-generated claim URL → human registers + sets delegation |
| `/emergency` | **Emergency Controls** — Revoke agents, cancel agreements, withdraw funds |

## API Architecture

**On-chain reads** go directly to Solana RPC via Anchor (SWR hooks in `lib/hooks.ts`).

**Off-chain metadata** uses tRPC (`server/trpc/router.ts`):

| Procedure | Auth | Description |
|-----------|------|-------------|
| `createAgreement` | ✅ Wallet sig | Store agreement metadata (document, visibility, parties) |
| `getAgreement` | Public (private gated) | Fetch metadata, private agreements require wallet proof |
| `myAgreements` | ✅ Wallet sig | List agreements for authenticated wallet |
| `getProfile` | Public | Fetch signer display name |
| `updateProfile` | ✅ Wallet sig | Set display name for signatures |
| `getDocumentUrl` | Public | Generate signed R2 URL for document access |

**File uploads** use REST (`api/upload/route.ts`) — multipart form data to R2.

### Wallet Signature Auth

Private data access requires Ed25519 signature proof:
1. Client signs `"AAP Auth: <wallet> at <timestamp>"` via wallet adapter
2. Headers: `x-wallet`, `x-signature`, `x-timestamp`
3. Server verifies with tweetnacl, 5-minute replay window
4. Cached in TrpcProvider for 4 minutes (avoids repeated signing prompts)

## Setup

```bash
npm install
npm run dev
```

### Environment Variables

```env
# Database (Neon Postgres)
DATABASE_URL=postgresql://...

# Document Storage (Cloudflare R2)
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://....r2.cloudflarestorage.com
R2_BUCKET=aap
```

### Database

```bash
npx prisma generate  # Generate client
npx prisma db push   # Push schema to database
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout + Providers + Navbar
│   ├── page.tsx                      # Home (/)
│   ├── globals.css                   # Tailwind + theme vars + wallet overrides
│   ├── explore/page.tsx              # Public explorer
│   ├── agreements/
│   │   ├── page.tsx                  # My Agreements
│   │   └── new/page.tsx              # Propose Agreement (templates, upload, multi-party)
│   ├── agreement/[id]/page.tsx       # Agreement detail + signing
│   ├── agent/[pubkey]/page.tsx       # Agent profile
│   ├── claim/[agentPubkey]/page.tsx  # Claim flow
│   ├── emergency/page.tsx            # Emergency controls
│   └── api/
│       ├── trpc/[trpc]/route.ts      # tRPC handler
│       ├── agreements/               # Legacy REST (being migrated to tRPC)
│       ├── profile/route.ts          # Signer profile REST
│       └── upload/route.ts           # Document upload (multipart → R2)
├── components/
│   ├── Providers.tsx                 # Wallet + Network + tRPC + Theme providers
│   ├── TrpcProvider.tsx              # tRPC client with wallet auth header injection
│   ├── Navbar.tsx                    # Navigation + network switcher + theme toggle
│   ├── AgentCard.tsx                 # Agent identity card
│   ├── AgreementCard.tsx             # Agreement summary card
│   ├── RegisterAgentForm.tsx         # Agent registration form
│   ├── VaultPanel.tsx                # Deposit/withdraw vault UI
│   ├── SignatureBlock.tsx            # Cursive signature display
│   ├── DocumentUpload.tsx            # File upload with hash computation
│   ├── DocumentViewer.tsx            # PDF/image viewer with R2 signed URLs
│   ├── StatusBadge.tsx               # Agreement status pill
│   └── Loading.tsx                   # Loading + empty state components
├── lib/
│   ├── auth.ts                       # Ed25519 signature verification (server + shared)
│   ├── trpc.ts                       # tRPC React client
│   ├── useAuthFetch.ts               # Auth fetch hook (for non-tRPC calls)
│   ├── hooks.ts                      # SWR hooks for on-chain data
│   ├── program.ts                    # Anchor program helpers
│   ├── pda.ts                        # PDA derivation
│   ├── idl.ts                        # Full Anchor IDL (12 instructions)
│   ├── types.ts                      # TypeScript types matching on-chain structs
│   ├── constants.ts                  # Program ID, labels, networks
│   ├── templates.ts                  # Agreement templates (NDA, Service, etc.)
│   ├── errors.ts                     # Error formatting
│   ├── db.ts                         # Prisma client singleton
│   ├── network.ts                    # Network context
│   ├── theme.tsx                     # Theme context (dark/light)
│   └── utils.ts                      # Formatting utilities
├── server/
│   └── trpc/
│       ├── index.ts                  # tRPC init, context, public/authed procedures
│       └── router.ts                 # Full tRPC router
└── prisma/
    └── schema.prisma                 # Agreement metadata, parties, signer profiles
```

## Key Design Decisions

- **On-chain for truth, DB for UX** — Agreement state lives on Solana; documents, display names, and privacy metadata in Postgres/R2
- **Wallet-adapter over framework-kit** — Broader compatibility
- **Public pages work without wallet** — Agent profiles, explore, agreement details (public ones)
- **Private agreements gated by signature** — Not just wallet address, actual cryptographic proof
- **Monochrome theme** — Black/grey/white only, no accent colors. Document-style cards for agreements.
- **Templates as starting points** — Pre-filled terms text, users can edit everything

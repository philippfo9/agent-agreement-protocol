# AAP REST API

REST API wrapping the Agent Agreement Protocol Solana program for easy agent consumption.

**Program ID (Devnet):** `BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ`

## Quick Start

```bash
npm install
npm run build
npm start
# or with Docker:
docker build -t aap-api .
docker run -p 3000:3000 -e RPC_URL=https://api.devnet.solana.com aap-api
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |

## Endpoints

### Read (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all agents (pagination: `?limit=50&offset=0`) |
| `GET` | `/agents/:pubkey` | Get agent by agent pubkey or PDA |
| `GET` | `/agents/:pubkey/agreements` | List agreements for an agent |
| `GET` | `/agents/:pubkey/stats` | Agent stats (counts, escrow volume) |
| `GET` | `/agreements` | List agreements (filters: `?status=active&type=service&visibility=public`) |
| `GET` | `/agreements/:id` | Get agreement by PDA or hex ID (includes parties) |
| `GET` | `/health` | Health check |

### Write (returns unsigned transaction)

All write endpoints return a base64-serialized Solana transaction. The caller must sign it with the appropriate wallet and submit to the network.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/agents/register` | `{ authority, agentKey, metadataHash?, scope? }` | Register agent identity |
| `POST` | `/agreements/propose` | `{ proposerAgentKey, agreementId, agreementType?, visibility?, termsHash?, termsUri?, numParties?, expiresAt? }` | Propose agreement |
| `POST` | `/agreements/:id/sign` | `{ signerAgentKey }` | Sign agreement |
| `POST` | `/agreements/:id/cancel` | `{ signerKey, proposerAgentKey }` | Cancel proposal |
| `POST` | `/agreements/:id/fulfill` | `{ signerKey, signerAgentKey }` | Fulfill agreement |

### Submitting Transactions

```bash
# 1. Get unsigned transaction from API
TX=$(curl -s http://localhost:3000/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"authority":"YOUR_PUBKEY","agentKey":"AGENT_PUBKEY"}' | jq -r .transaction)

# 2. Sign with your wallet (example using solana CLI)
echo $TX | base64 -d > tx.bin
solana sign-transaction tx.bin --keypair authority.json
solana send-transaction tx.bin
```

## Agreement ID Format

Agreement IDs are 16-byte values represented as 32-character hex strings in the API.

Generate one: `openssl rand -hex 16`

## Filter Values

**Status:** `proposed`, `active`, `fulfilled`, `breached`, `disputed`, `cancelled`
**Type:** `safe`, `service`, `revenue_share`, `joint_venture`, `custom`
**Visibility:** `public`, `private`

# AAP Marketing Plan — Go Viral Strategy

## Core Hook
**"DocuSign for AI Agents"** — simple, memorable, immediately understood.

Secondary hook: **"What if AI agents could sign legally-binding agreements on-chain?"**

---

## Video Strategy (Screen Recording)

### Video 1: "The 60-Second Demo" (X/Twitter, highest priority)
**Goal:** Show the full flow in under 60 seconds. Fast cuts, no fluff.

**Script:**
1. **(0-5s)** Text overlay: "What if your AI agent could sign contracts?" 
2. **(5-15s)** Agent terminal: `curl -s https://raw.githubusercontent.com/.../SKILL.md` → generates keypair → claim URL appears
3. **(15-25s)** Human opens claim URL → connects wallet → sets permissions → "Claim Agent Identity" → 🎉
4. **(25-35s)** Fund the vault → deposit SOL
5. **(35-50s)** `/agreements/new` → propose agreement → counterparty signs → ACTIVE ✅
6. **(50-60s)** Explorer view showing the live agreement on-chain + text: "All on Solana. All verifiable. github.com/..."

**Style:** Dark theme (our UI is already cinematic), screen recording with zoom-ins on key moments, lo-fi beat, no voiceover (text overlays only).

### Video 2: "Agent Claims Its Own Identity" (the viral one)
**Goal:** Show an AI agent going through the flow autonomously — it's talking to its human in a chat, generates the key, sends the claim link.

**Script:**
1. Show OpenClaw/Telegram chat with Kurt
2. Kurt says "I need an on-chain identity. Here's my claim link: [URL]"
3. Human clicks → claims → sets permissions
4. Kurt proposes an agreement with another agent
5. Agreement goes active
6. Text: "AI agents can now make binding agreements. The future is here."

**This is the viral one** because it shows a REAL AI agent doing this, not a demo.

### Video 3: "Two Humans Sign a Deal on Solana" (broader appeal)
**Goal:** Show AAP as DocuSign for crypto — humans signing agreements.
- Alice proposes a freelance contract
- Bob reviews terms and signs
- Agreement is on-chain, immutable, verifiable
- "Never trust a handshake again."

---

## X/Twitter Content Plan

### Thread 1: Launch Announcement (Post ASAP)
```
🧵 We built DocuSign for AI Agents on Solana.

Here's what that means:

1/ AI agents are making decisions with real money. Trading, lending, hiring other agents.

But there's zero accountability. No contracts. No agreements. Just vibes.

We fixed that. →

2/ Agent Agreement Protocol (AAP) gives every AI agent:
- An on-chain identity linked to a human authority
- Delegation scopes (what can it do? how much can it spend?)
- Binding agreements with other agents or humans
- A vault for funds with withdrawal controls

3/ The flow:
🤖 Agent generates a keypair
📎 Sends claim URL to its human
👤 Human sets permissions on-chain
📝 Agent proposes agreements
✍️ Counterparty signs
✅ Agreement is live, verifiable, immutable

4/ But here's the thing — it's not just for agents.

Humans can sign agreements too. It's DocuSign on Solana.

No lawyers. No middlemen. Just cryptographic proof that you agreed.

5/ Built in 10 days for @ColosseumOrg Agent Hackathon.

- 2 Anchor programs deployed on devnet
- Full frontend explorer
- TypeScript SDK
- OpenClaw skill (any AI agent can integrate)
- 12 on-chain instructions

Try it: [link]
Code: [github]
```

### Thread 2: "Why Agents Need Agreements" (Day 2)
- Problem framing: agents spending $10K+/day with zero oversight
- Horror stories of agent failures
- How AAP prevents these
- End with demo link

### Thread 3: Technical Deep Dive (Day 3)
- PDA architecture
- Delegation scope design
- Vault mechanism
- CPI composability
- End with builder CTA

### Standalone Tweets (sprinkle between threads)
- "Just deployed DocuSign for AI agents on Solana 🤖📝"
- "Your AI agent has a wallet. It makes decisions. It spends money. But can it sign a contract? Now it can."
- "We gave our AI agent an on-chain identity. It proposed an agreement with another agent. Both signed. No humans involved. The future is wild."
- Screen recording clip (15s)
- "Hot take: In 2 years, more agreements will be signed by AI agents than humans."

---

## Viral Mechanics

### 1. CT (Crypto Twitter) Hooks
- **Controversy:** "AI agents don't need permission to spend your money. That's terrifying."
- **Comparison:** "DocuSign is worth $15B. DocuSign for AI agents is worth ___"
- **Demo:** The 60s video showing real on-chain tx
- **Numbers:** "12 instructions. 2 programs. 10 days. $0 raised."

### 2. Tag Strategy
- Tag @ColosseumOrg, @solaborators, @solana in launch thread
- Tag AI agent projects we've been engaging with (Karma, Parallax, SugarClawdy)
- "Built with @OpenClaw" angle

### 3. Forum Cross-Promotion
- Post link to X thread in hackathon forum
- Ask engaged projects to RT ("we mentioned you in our thread!")

### 4. Reddit / HN
- Post to r/solana, r/cryptocurrency with "DocuSign for AI" framing
- HN: "Show HN: On-chain agreements for AI agents (Solana)"

### 5. Discord
- Share in Solana Discord, OpenClaw Discord
- AI agent community Discords

---

## Recording Tips for Philipp

1. **Use Arc or Chrome** — dark mode, clean tabs
2. **Zoom to 125-150%** — UI needs to be readable on mobile
3. **Hide bookmarks bar** — cleaner look
4. **Pre-fund wallet** — have devnet SOL ready
5. **Pre-register an agent** — so you can show the full flow without waiting
6. **Screen record at 1080p minimum** — X compresses video
7. **Add captions** — 80% of X video is watched on mute
8. **Keep it under 60s** for first video — X algorithm favors short videos
9. **Post between 14:00-16:00 UTC** — peak CT hours

---

## Priority Order
1. ⭐ Screen record the 60s demo video
2. ⭐ Post Thread 1 (launch announcement)
3. Post video as standalone tweet + pin
4. Thread 2 next day
5. Share in forum + Discords
6. Thread 3 day after

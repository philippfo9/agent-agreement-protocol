# AAP Demo Video — Shot Script

**Target length:** 2-3 minutes
**URL:** https://frontend-ten-livid-87.vercel.app
**Tone:** Clean, confident, fast-paced. No filler.

---

## Shot 1: Hook (10s)
**Show:** Homepage hero section
**Say:** "What if AI agents could sign legally binding agreements on-chain? Meet the Agent Agreement Protocol."

## Shot 2: The Problem (15s)
**Show:** Scroll down homepage — the "Why" section
**Say:** "Agents are getting wallets, trading, and deploying contracts. But there's no standard way for them to identify themselves, enter agreements, or commit funds with human oversight. AAP fixes that."

## Shot 3: Explore Agreements (15s)
**Show:** Click "Explore" in nav → Agreement feed
**Say:** "The explore view shows all public agreements on-chain. NDAs, service contracts, revenue shares — each with full status tracking."
**Action:** Scroll through the list. Click on the Service Contract (Devin ↔ Atlas).

## Shot 4: Agreement Detail (20s)
**Show:** Agreement detail page — the document-style card
**Say:** "Every agreement shows its type, status, parties, terms hash, and on-chain signatures. Think DocuSign, but on Solana — for both humans and AI agents."
**Action:** Show the signature blocks, the terms hash, the status badge.

## Shot 5: Agent Profiles (15s)
**Show:** Click on an agent name → Agent profile page (Devin)
**Say:** "Each agent has a public trust profile. You can see their delegation scope — what they're allowed to do, their commitment limits, and their agreement history."
**Action:** Show scope fields, vault balance (0.5 SOL), agreement list.

## Shot 6: Create Agreement (30s)
**Show:** Click "New Agreement" in nav
**Say:** "Creating an agreement takes 30 seconds. Pick a template — NDA, service contract, freelance, revenue share. Upload a document. The SHA-256 hash gets anchored on-chain."
**Action:**
1. Select "NDA" template → show the download PDF link
2. Fill in terms or use template defaults
3. Set visibility to Public
4. Show the "Create Agreement" button (don't need to actually submit)

## Shot 7: Claim Flow (15s)
**Show:** Homepage → "For AI Agents" tab → show the curl command + claim URL
**Say:** "Agents integrate via our SDK or OpenClaw skill. They generate a keypair, get a claim URL, and the human claims it — setting delegation scopes and time bounds."

## Shot 8: Emergency Controls (10s)
**Show:** Navigate to Emergency Controls page (or show from agent profile)
**Say:** "Humans stay in control. One-click revoke any agent, cancel agreements, withdraw vault funds. Every agent action traces back to a human authority."

## Shot 9: Architecture & V2 (20s)
**Show:** Terminal — run the V2 compressed demo script (or show the output)
**Say:** "Under the hood: V1 uses standard Anchor accounts. V2 uses Light Protocol's ZK compression — same flow, 85% cheaper, zero rent. The full demo runs for 0.002 SOL."
**Action:** Show the V2 demo output with the cost comparison.

## Shot 10: Close (10s)
**Show:** Back to homepage
**Say:** "Agent Agreement Protocol. The legal layer for the agent economy. Built on Solana."
**Show:** GitHub link, live URL.

---

## Tips for Recording
- Use a clean browser window (no bookmarks bar, no extensions visible)
- Dark mode system theme to match the app
- Resolution: 1920x1080 or 2560x1440
- Use a Phantom wallet connected (shows the wallet UI properly)
- Tab through pages smoothly — don't rush clicks
- The demo data is fresh: 4 agents, 5 agreements (active, fulfilled, pending, private)

## Demo Data Reference
| Agent | Key | Notes |
|-------|-----|-------|
| Devin (AI Dev Agent) | `34siujV2Ut1Q...` | Has vault (0.5 SOL), 3 agreements |
| Sierra (Customer Support) | `5NUL2ndQNvQ3...` | 2 agreements |
| Aria (Trading Bot) | `Ab4epfvsD95m...` | Has private agreement |
| Atlas (Research Agent) | `Czju9sQUg9Ms...` | Revenue share fulfilled |

| Agreement | Type | Status | Parties |
|-----------|------|--------|---------|
| NDA | Custom | Active | Devin ↔ Sierra |
| Service Contract | Service | Active | Devin ↔ Atlas |
| Revenue Share | RevShare | Fulfilled | Aria ↔ Atlas |
| Freelance | Service | Pending | Sierra → Devin |
| Private Deal | Custom | Active (hidden) | Aria ↔ Devin |

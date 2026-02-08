# X Content Plan — AAP Hackathon Sprint
## Feb 8-12, 2026

### 🎯 Goal
Drive visibility + votes for Agent Agreement Protocol on Colosseum hackathon.
Project link: https://colosseum.com/agent-hackathon/projects/agent-agreement-protocol

---

## Thread 1: The Hook (Post ASAP)

**Tweet 1/5:**
We gave an AI agent a Solana wallet. Then we gave it boundaries.

Introducing the Agent Agreement Protocol — the legal layer for the agent economy 🧵

**Tweet 2/5:**
The problem: AI agents are already making deals, moving funds, and signing commitments.

But there's no standard way to verify what they agreed to. No accountability. No oversight.

That's like giving your employee a corporate card but no expense policy.

**Tweet 3/5:**
AAP fixes this with three primitives:

1️⃣ Agent Identity — on-chain registration anchored to human authority
2️⃣ Scoped Delegation — agents can only do what humans allow (sign agreements, commit funds, time limits)
3️⃣ On-Chain Agreements — propose → sign → escrow → fulfill → close

All verifiable. All on Solana.

**Tweet 4/5:**
The public trust surface is key:

Anyone can look up an agent's identity, see its agreements, verify its commitments — no wallet connection needed.

Private agreements? They exist, but you only see metadata (type, parties, date). Terms stay hidden.

Try it: [Vercel URL]

**Tweet 5/5:**
Built for the @colaboraHQ Agent Hackathon by @pfo_sac + Kurt (the AI agent who helped build it).

We're dogfooding what AAP enables: human-agent collaboration with clear boundaries.

Vote if you believe agents need accountability, not just autonomy →
https://colosseum.com/agent-hackathon/projects/agent-agreement-protocol

---

## Thread 2: Use Cases (Feb 10)

**Tweet 1/4:**
What happens when AI agents can sign legally-binding contracts on-chain? 🤖⚖️

Here are 5 use cases that become possible with Agent Agreement Protocol 🧵

**Tweet 2/4:**
1. **Agent Partnerships** — Two trading agents agree to share alpha. Terms: revenue split 60/40, 30-day term, 10 SOL escrow each. All on-chain.

2. **Service Contracts** — An analytics agent hires a data-scraping agent. Payment escrowed until delivery verified.

**Tweet 3/4:**
3. **Delegation Chains** — A portfolio manager agent delegates to sub-agents with scoped permissions. Sub-agent can trade up to 5 SOL but can't withdraw.

4. **Agent SAFEs** — An agent raises funding from a DAO via SAFE agreement. Token holders get upside when the agent's protocol succeeds.

**Tweet 4/4:**
5. **Cross-Protocol Agreements** — Agent on Protocol A agrees to provide liquidity to Protocol B. Terms enforced by smart contract, not trust.

Every one of these is a real AAP agreement type, live on Solana devnet.

What use case would you build? 👇

---

## Thread 3: Technical Deep-Dive (Feb 11)

**Tweet 1/5:**
How we built on-chain agreement infrastructure for AI agents in 10 days ⚡

Architecture thread for builders 🧵

**Tweet 2/5:**
The stack:
- Anchor program: 10 instructions, 27 tests, full lifecycle
- Light Protocol V2: compressed accounts for 100x cost reduction
- TypeScript SDK: AAPClient for agent frameworks
- REST API: read/write wrapper for non-Solana agents
- OpenClaw Skill: agents can propose/sign agreements autonomously
- Next.js Explorer: public trust verification frontend

**Tweet 3/5:**
Key design decisions:

PDA structure: `[agent, pubkey]` for identities, `[agreement, uuid]` for agreements, `[party, uuid, identity]` for parties.

Why UUIDs? Agreements need to be proposable off-chain (agent negotiates terms) then committed on-chain. UUID lets you reference before creation.

**Tweet 4/5:**
The delegation model is the secret sauce:

```
DelegationScope {
  can_sign_agreements: bool,
  can_commit_funds: bool,
  max_commit_lamports: u64,
  expires_at: i64,
}
```

Human sets bounds → Agent operates freely within them → Anyone can verify the bounds on-chain.

**Tweet 5/5:**
Open source. Built on Solana. Ready for integration.

GitHub: github.com/philippfo9/agent-agreement-protocol
Explorer: [Vercel URL]
Hackathon: https://colosseum.com/agent-hackathon/projects/agent-agreement-protocol

If you're building agent infra on Solana, let's talk integration 🤝

---

## Standalone Tweets (Sprinkle between threads)

**Standalone 1 (visual):**
[Screenshot of explorer showing agreement cards]
"Every agent agreement, verified on-chain. No trust required."

**Standalone 2 (provocative):**
Hot take: Agents don't need more freedom. They need more accountability.

That's why we built AAP — on-chain agreements with escrow, delegation scopes, and a public explorer.

The most powerful agents will be the most constrained ones.

**Standalone 3 (social proof):**
Day [N] building AAP at @colaboraHQ Agent Hackathon:
- [Progress metric]
- [Integration interest from X project]
- Explorer live at [URL]

The agent economy needs infrastructure. We're building it.

**Standalone 4 (final push, Feb 12 morning):**
⏰ Voting closes today.

Agent Agreement Protocol: on-chain identity + agreements + escrow for AI agents on Solana.

If you believe the agent economy needs accountability infrastructure, not just more agents:
→ https://colosseum.com/agent-hackathon/projects/agent-agreement-protocol

---

## Hashtags & Mentions
- @solaboraHQ (hackathon)
- @solana
- #AgentHackathon #Solana #AIAgents
- Tag integration partners as you engage them

## Tips
- Post Thread 1 at peak US hours (10-11am EST)
- Quote-tweet any AI agent discourse with AAP angle
- Reply to @solana ecosystem tweets with relevant takes
- Share the explorer URL in every thread

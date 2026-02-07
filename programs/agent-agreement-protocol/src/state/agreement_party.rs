use anchor_lang::prelude::*;

#[account]
pub struct AgreementParty {
    pub agreement: Pubkey,         // 32 bytes — Agreement PDA
    pub agent_identity: Pubkey,    // 32 bytes — AgentIdentity PDA
    pub role: u8,                  // 1 byte — 0=Proposer, 1=Counterparty, 2=Witness, 3=Arbitrator
    pub signed: bool,              // 1 byte
    pub signed_at: i64,            // 8 bytes — 0 if not signed
    pub escrow_deposited: u64,     // 8 bytes — this party's escrow contribution
    pub bump: u8,                  // 1 byte
}

impl AgreementParty {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1 + 8 + 8 + 1; // 91 bytes
}

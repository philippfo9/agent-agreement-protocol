use anchor_lang::prelude::*;

#[account]
pub struct Agreement {
    pub agreement_id: [u8; 16],    // 16 bytes — UUID or truncated hash
    pub agreement_type: u8,        // 1 byte — enum as u8
    pub status: u8,                // 1 byte — enum as u8
    pub visibility: u8,            // 1 byte — 0 = public, 1 = private
    pub proposer: Pubkey,          // 32 bytes — AgentIdentity PDA
    pub terms_hash: [u8; 32],      // 32 bytes — SHA-256 of full terms document
    pub terms_uri: [u8; 64],       // 64 bytes — Arweave TX ID or URI
    pub escrow_vault: Pubkey,      // 32 bytes — PDA token account
    pub escrow_mint: Pubkey,       // 32 bytes — token mint
    pub escrow_total: u64,         // 8 bytes — total escrow deposited
    pub num_parties: u8,           // 1 byte — how many parties (max 8)
    pub num_signed: u8,            // 1 byte — how many have signed
    pub parties_added: u8,         // 1 byte — how many parties have been added so far
    pub created_at: i64,           // 8 bytes
    pub expires_at: i64,           // 8 bytes — 0 = no expiry
    pub bump: u8,                  // 1 byte
}

impl Agreement {
    pub const LEN: usize = 8 + 16 + 1 + 1 + 1 + 32 + 32 + 64 + 32 + 32 + 8 + 1 + 1 + 1 + 8 + 8 + 1; // 247 bytes
}

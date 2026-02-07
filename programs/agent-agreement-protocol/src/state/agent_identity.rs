use anchor_lang::prelude::*;

#[account]
pub struct AgentIdentity {
    pub authority: Pubkey,        // 32 bytes — human owner
    pub agent_key: Pubkey,        // 32 bytes — agent's signing key
    pub metadata_hash: [u8; 32],  // 32 bytes — SHA-256 of off-chain metadata JSON
    pub scope: DelegationScope,   // 18 bytes — what this agent can do
    pub parent: Pubkey,           // 32 bytes — Pubkey::default() if no parent
    pub created_at: i64,          // 8 bytes
    pub bump: u8,                 // 1 byte
}

impl AgentIdentity {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 18 + 32 + 8 + 1; // 163 bytes
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace)]
pub struct DelegationScope {
    pub can_sign_agreements: bool, // 1 byte
    pub can_commit_funds: bool,    // 1 byte
    pub max_commit_lamports: u64,  // 8 bytes — max value per agreement (0 = unlimited)
    pub expires_at: i64,           // 8 bytes — 0 = never expires
}

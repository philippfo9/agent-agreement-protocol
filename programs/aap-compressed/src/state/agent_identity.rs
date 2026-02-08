use anchor_lang::prelude::*;
use light_sdk::LightDiscriminator;

/// Compressed AgentIdentity — same fields as V1 but stored as a compressed account.
/// No rent required. Uses SHA256 borsh hashing.
#[derive(Clone, Debug, Default, LightDiscriminator, AnchorSerialize, AnchorDeserialize)]
pub struct CompressedAgentIdentity {
    pub authority: Pubkey,        // human owner
    pub agent_key: Pubkey,        // agent's signing key
    pub metadata_hash: [u8; 32],  // SHA-256 of off-chain metadata JSON
    pub scope: CompressedDelegationScope,
    pub parent: Pubkey,           // Pubkey::default() if no parent
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct CompressedDelegationScope {
    pub can_sign_agreements: bool,
    pub can_commit_funds: bool,
    pub max_commit_lamports: u64,
    pub expires_at: i64,
}

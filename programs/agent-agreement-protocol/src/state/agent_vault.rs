use anchor_lang::prelude::*;

/// A vault PDA that holds SOL on behalf of an agent.
/// Seeds: ["vault", agent_identity.key()]
/// The vault is a system-owned PDA whose lamport balance is the deposited amount.
/// We don't need a custom account struct — we use the PDA itself as a native SOL vault.
/// This file exists for documentation; the actual vault is just a PDA with lamports.

#[account]
pub struct AgentVault {
    pub agent_identity: Pubkey,  // 32 bytes — the agent identity this vault belongs to
    pub authority: Pubkey,       // 32 bytes — human authority who can deposit/withdraw
    pub total_deposited: u64,    // 8 bytes — lifetime deposits
    pub total_withdrawn: u64,    // 8 bytes — lifetime withdrawals  
    pub total_committed: u64,    // 8 bytes — total committed to agreements
    pub bump: u8,                // 1 byte
}

impl AgentVault {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1; // 97 bytes

    /// Available balance = lamports in vault account - rent-exempt minimum - committed
    pub fn available_balance(&self, vault_lamports: u64, rent_exempt: u64) -> u64 {
        vault_lamports
            .saturating_sub(rent_exempt)
            .saturating_sub(self.total_committed)
    }
}

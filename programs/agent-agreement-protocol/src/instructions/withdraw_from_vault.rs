use anchor_lang::prelude::*;
use crate::state::{AgentIdentity, AgentVault};
use crate::errors::AapError;
use crate::events::VaultWithdraw;

#[derive(Accounts)]
pub struct WithdrawFromVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = agent_identity.authority == authority.key() @ AapError::Unauthorized,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [b"vault", agent_identity.key().as_ref()],
        bump = vault.bump,
        constraint = vault.authority == authority.key() @ AapError::Unauthorized,
    )]
    pub vault: Account<'info, AgentVault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFromVault>, amount: u64) -> Result<()> {
    require!(amount > 0, AapError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;
    let rent = Rent::get()?;
    let rent_exempt = rent.minimum_balance(AgentVault::LEN);
    let available = vault.available_balance(vault.to_account_info().lamports(), rent_exempt);

    require!(amount <= available, AapError::InsufficientVaultBalance);

    // Transfer SOL from vault PDA to authority
    // For PDA transfers, we modify lamports directly
    **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;

    vault.total_withdrawn = vault.total_withdrawn.checked_add(amount).unwrap();

    emit!(VaultWithdraw {
        agent_identity: ctx.accounts.agent_identity.key(),
        authority: ctx.accounts.authority.key(),
        amount,
        remaining_balance: vault.to_account_info().lamports(),
    });

    Ok(())
}

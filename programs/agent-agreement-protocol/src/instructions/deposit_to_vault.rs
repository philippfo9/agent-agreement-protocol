use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{AgentIdentity, AgentVault};
use crate::errors::AapError;
use crate::events::VaultDeposit;

#[derive(Accounts)]
pub struct DepositToVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = agent_identity.authority == authority.key() @ AapError::Unauthorized,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        init_if_needed,
        payer = authority,
        space = AgentVault::LEN,
        seeds = [b"vault", agent_identity.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, AgentVault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositToVault>, amount: u64) -> Result<()> {
    require!(amount > 0, AapError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;
    
    // Initialize vault fields if first deposit
    if vault.agent_identity == Pubkey::default() {
        vault.agent_identity = ctx.accounts.agent_identity.key();
        vault.authority = ctx.accounts.authority.key();
        vault.total_deposited = 0;
        vault.total_withdrawn = 0;
        vault.total_committed = 0;
        vault.bump = ctx.bumps.vault;
    }

    // Transfer SOL from authority to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: vault.to_account_info(),
            },
        ),
        amount,
    )?;

    vault.total_deposited = vault.total_deposited.checked_add(amount).unwrap();

    emit!(VaultDeposit {
        agent_identity: ctx.accounts.agent_identity.key(),
        authority: ctx.accounts.authority.key(),
        amount,
        new_balance: vault.to_account_info().lamports(),
    });

    Ok(())
}

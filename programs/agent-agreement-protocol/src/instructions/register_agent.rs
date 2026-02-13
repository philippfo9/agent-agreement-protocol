use anchor_lang::prelude::*;
use crate::errors::AapError;
use crate::events::AgentRegistered;
use crate::state::{AgentIdentity, DelegationScope};

#[derive(Accounts)]
#[instruction(agent_key: Pubkey)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = AgentIdentity::LEN,
        seeds = [b"agent", agent_key.as_ref()],
        bump,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterAgent>,
    agent_key: Pubkey,
    metadata_hash: [u8; 32],
    scope: DelegationScope,
) -> Result<()> {
    // Agent key can equal authority (human signer mode) or differ (delegated agent mode)

    // Validate scope expiration
    if scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            scope.expires_at > clock.unix_timestamp,
            AapError::ScopeExpired
        );
    }

    let identity = &mut ctx.accounts.agent_identity;
    identity.authority = ctx.accounts.authority.key();
    identity.agent_key = agent_key;
    identity.metadata_hash = metadata_hash;
    identity.scope = scope;
    identity.parent = Pubkey::default();
    identity.created_at = Clock::get()?.unix_timestamp;
    identity.bump = ctx.bumps.agent_identity;

    emit!(AgentRegistered {
        authority: ctx.accounts.authority.key(),
        agent_key,
        agent_identity: ctx.accounts.agent_identity.key(),
    });

    Ok(())
}

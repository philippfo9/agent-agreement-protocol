use anchor_lang::prelude::*;
use crate::errors::AapError;
use crate::events::DelegationUpdated;
use crate::state::{AgentIdentity, DelegationScope};

#[derive(Accounts)]
pub struct UpdateDelegation<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ AapError::Unauthorized,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
}

pub fn handler(
    ctx: Context<UpdateDelegation>,
    new_scope: DelegationScope,
) -> Result<()> {
    if new_scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            new_scope.expires_at > clock.unix_timestamp,
            AapError::ScopeExpired
        );
    }

    ctx.accounts.agent_identity.scope = new_scope;

    emit!(DelegationUpdated {
        authority: ctx.accounts.authority.key(),
        agent_identity: ctx.accounts.agent_identity.key(),
    });

    Ok(())
}

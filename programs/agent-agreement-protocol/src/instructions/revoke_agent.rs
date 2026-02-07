use anchor_lang::prelude::*;
use crate::errors::AapError;
use crate::events::AgentRevoked;
use crate::state::AgentIdentity;

#[derive(Accounts)]
pub struct RevokeAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        has_one = authority @ AapError::Unauthorized,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
}

pub fn handler(ctx: Context<RevokeAgent>) -> Result<()> {
    let agent_key = ctx.accounts.agent_identity.agent_key;

    emit!(AgentRevoked {
        authority: ctx.accounts.authority.key(),
        agent_key,
    });

    Ok(())
}

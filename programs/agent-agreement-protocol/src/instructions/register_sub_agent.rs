use anchor_lang::prelude::*;
use crate::errors::AapError;
use crate::events::AgentRegistered;
use crate::state::{AgentIdentity, DelegationScope};

#[derive(Accounts)]
#[instruction(sub_agent_key: Pubkey)]
pub struct RegisterSubAgent<'info> {
    #[account(mut)]
    pub parent_agent_signer: Signer<'info>,

    #[account(
        constraint = parent_identity.agent_key == parent_agent_signer.key() @ AapError::Unauthorized,
    )]
    pub parent_identity: Account<'info, AgentIdentity>,

    #[account(
        init,
        payer = parent_agent_signer,
        space = AgentIdentity::LEN,
        seeds = [b"agent", sub_agent_key.as_ref()],
        bump,
    )]
    pub sub_agent_identity: Account<'info, AgentIdentity>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterSubAgent>,
    sub_agent_key: Pubkey,
    metadata_hash: [u8; 32],
    scope: DelegationScope,
) -> Result<()> {
    let parent = &ctx.accounts.parent_identity;

    // Parent must not be a sub-agent itself (max 2 levels)
    require!(
        parent.parent == Pubkey::default(),
        AapError::MaxDelegationDepth
    );

    // Parent delegation must not be expired
    if parent.scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            parent.scope.expires_at > clock.unix_timestamp,
            AapError::DelegationExpired
        );
    }

    // Sub-agent scope cannot exceed parent scope
    if parent.scope.can_sign_agreements {
        // ok, sub can have can_sign_agreements = true or false
    } else {
        require!(
            !scope.can_sign_agreements,
            AapError::SubAgentScopeExceedsParent
        );
    }

    if parent.scope.can_commit_funds {
        if parent.scope.max_commit_lamports > 0 {
            require!(
                scope.max_commit_lamports <= parent.scope.max_commit_lamports,
                AapError::SubAgentScopeExceedsParent
            );
        }
    } else {
        require!(
            !scope.can_commit_funds,
            AapError::SubAgentScopeExceedsParent
        );
    }

    // Validate scope expiration
    if scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            scope.expires_at > clock.unix_timestamp,
            AapError::ScopeExpired
        );
    }

    let identity = &mut ctx.accounts.sub_agent_identity;
    identity.authority = parent.authority;
    identity.agent_key = sub_agent_key;
    identity.metadata_hash = metadata_hash;
    identity.scope = scope;
    identity.parent = ctx.accounts.parent_identity.key();
    identity.created_at = Clock::get()?.unix_timestamp;
    identity.bump = ctx.bumps.sub_agent_identity;

    emit!(AgentRegistered {
        authority: parent.authority,
        agent_key: sub_agent_key,
        agent_identity: ctx.accounts.sub_agent_identity.key(),
    });

    Ok(())
}

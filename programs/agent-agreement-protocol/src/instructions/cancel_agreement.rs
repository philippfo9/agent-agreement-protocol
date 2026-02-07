use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::AgreementCancelled;
use crate::state::{AgentIdentity, Agreement};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct CancelAgreement<'info> {
    pub signer: Signer<'info>,

    /// Proposer's AgentIdentity — signer must be the agent_key or authority
    #[account(
        constraint = (
            proposer_identity.agent_key == signer.key() ||
            proposer_identity.authority == signer.key()
        ) @ AapError::Unauthorized,
    )]
    pub proposer_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump = agreement.bump,
        constraint = agreement.proposer == proposer_identity.key() @ AapError::Unauthorized,
        constraint = agreement.status == STATUS_PROPOSED @ AapError::InvalidStatus,
    )]
    pub agreement: Account<'info, Agreement>,
}

pub fn handler(
    ctx: Context<CancelAgreement>,
    agreement_id: [u8; 16],
) -> Result<()> {
    ctx.accounts.agreement.status = STATUS_CANCELLED;

    emit!(AgreementCancelled { agreement_id });

    Ok(())
}

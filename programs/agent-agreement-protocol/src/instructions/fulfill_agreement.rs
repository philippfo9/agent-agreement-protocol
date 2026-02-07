use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::AgreementFulfilled;
use crate::state::{AgentIdentity, Agreement, AgreementParty};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct FulfillAgreement<'info> {
    pub signer: Signer<'info>,

    /// Signer's AgentIdentity — must be the agent_key or authority
    #[account(
        constraint = (
            signer_identity.agent_key == signer.key() ||
            signer_identity.authority == signer.key()
        ) @ AapError::Unauthorized,
    )]
    pub signer_identity: Account<'info, AgentIdentity>,

    /// Signer must be a party to the agreement
    #[account(
        seeds = [b"party", agreement_id.as_ref(), signer_identity.key().as_ref()],
        bump = signer_party.bump,
    )]
    pub signer_party: Account<'info, AgreementParty>,

    #[account(
        mut,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump = agreement.bump,
        constraint = agreement.status == STATUS_ACTIVE @ AapError::InvalidStatus,
    )]
    pub agreement: Account<'info, Agreement>,
}

pub fn handler(
    ctx: Context<FulfillAgreement>,
    _agreement_id: [u8; 16],
) -> Result<()> {
    let agreement = &mut ctx.accounts.agreement;
    agreement.status = STATUS_FULFILLED;

    emit!(AgreementFulfilled {
        agreement_id: agreement.agreement_id,
    });

    Ok(())
}

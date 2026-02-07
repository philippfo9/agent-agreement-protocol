use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::state::{AgentIdentity, Agreement, AgreementParty};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct CloseAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Signer's AgentIdentity — signer must be the authority
    #[account(
        constraint = signer_identity.authority == signer.key() @ AapError::Unauthorized,
    )]
    pub signer_identity: Account<'info, AgentIdentity>,

    /// Signer must be a party to the agreement
    #[account(
        mut,
        close = signer,
        seeds = [b"party", agreement_id.as_ref(), signer_identity.key().as_ref()],
        bump = signer_party.bump,
    )]
    pub signer_party: Account<'info, AgreementParty>,

    #[account(
        mut,
        close = signer,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump = agreement.bump,
        constraint = (
            agreement.status == STATUS_FULFILLED ||
            agreement.status == STATUS_CANCELLED ||
            agreement.status == STATUS_BREACHED
        ) @ AapError::InvalidStatus,
    )]
    pub agreement: Account<'info, Agreement>,
}

pub fn handler(
    _ctx: Context<CloseAgreement>,
    _agreement_id: [u8; 16],
) -> Result<()> {
    // Accounts are closed via the `close` attribute
    msg!("Agreement closed, rent reclaimed");
    Ok(())
}

use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::{AgreementSigned, AgreementActivated};
use crate::state::{Agreement, AgreementParty};

/// Sign an agreement directly with a wallet — no identity registration required.
/// The party PDA must be seeded by the signer's pubkey.
/// Used for human-to-human agreements.
#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct SignAgreementDirect<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump = agreement.bump,
        constraint = agreement.status == STATUS_PROPOSED @ AapError::InvalidStatus,
    )]
    pub agreement: Account<'info, Agreement>,

    #[account(
        mut,
        seeds = [b"party", agreement_id.as_ref(), signer.key().as_ref()],
        bump = party.bump,
        constraint = party.agent_identity == signer.key() @ AapError::Unauthorized,
        constraint = !party.signed @ AapError::AlreadySigned,
    )]
    pub party: Account<'info, AgreementParty>,
}

pub fn handler(
    ctx: Context<SignAgreementDirect>,
    agreement_id: [u8; 16],
) -> Result<()> {
    // Check agreement expiry
    if ctx.accounts.agreement.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            ctx.accounts.agreement.expires_at > clock.unix_timestamp,
            AapError::AgreementExpired
        );
    }

    let clock = Clock::get()?;

    let party = &mut ctx.accounts.party;
    party.signed = true;
    party.signed_at = clock.unix_timestamp;

    let agreement = &mut ctx.accounts.agreement;
    agreement.num_signed += 1;

    emit!(AgreementSigned {
        agreement_id,
        party: ctx.accounts.signer.key(),
    });

    if agreement.num_signed == agreement.num_parties {
        agreement.status = STATUS_ACTIVE;
        emit!(AgreementActivated { agreement_id });
    }

    Ok(())
}

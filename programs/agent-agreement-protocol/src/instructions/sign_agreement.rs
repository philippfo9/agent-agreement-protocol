use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::{AgreementSigned, AgreementActivated};
use crate::state::{AgentIdentity, Agreement, AgreementParty};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct SignAgreement<'info> {
    pub signer: Signer<'info>,

    #[account(
        constraint = signer_identity.agent_key == signer.key() @ AapError::Unauthorized,
    )]
    pub signer_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump = agreement.bump,
        constraint = agreement.status == STATUS_PROPOSED @ AapError::InvalidStatus,
    )]
    pub agreement: Account<'info, Agreement>,

    #[account(
        mut,
        seeds = [b"party", agreement_id.as_ref(), signer_identity.key().as_ref()],
        bump = party.bump,
        constraint = !party.signed @ AapError::AlreadySigned,
    )]
    pub party: Account<'info, AgreementParty>,
}

pub fn handler(
    ctx: Context<SignAgreement>,
    agreement_id: [u8; 16],
) -> Result<()> {
    let identity = &ctx.accounts.signer_identity;

    // Validate delegation is not expired
    if identity.scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            identity.scope.expires_at > clock.unix_timestamp,
            AapError::DelegationExpired
        );
    }

    // Validate can_sign_agreements
    require!(
        identity.scope.can_sign_agreements,
        AapError::CannotSignAgreements
    );

    // Check agreement expiry
    let agreement = &ctx.accounts.agreement;
    if agreement.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            agreement.expires_at > clock.unix_timestamp,
            AapError::AgreementExpired
        );
    }

    let clock = Clock::get()?;

    // Update party
    let party = &mut ctx.accounts.party;
    party.signed = true;
    party.signed_at = clock.unix_timestamp;

    // Update agreement
    let agreement = &mut ctx.accounts.agreement;
    agreement.num_signed += 1;

    emit!(AgreementSigned {
        agreement_id,
        party: ctx.accounts.signer_identity.key(),
    });

    // Check if all parties signed
    if agreement.num_signed == agreement.num_parties {
        agreement.status = STATUS_ACTIVE;
        emit!(AgreementActivated { agreement_id });
    }

    Ok(())
}

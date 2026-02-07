use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::PartyAdded;
use crate::state::{AgentIdentity, Agreement, AgreementParty};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct AddParty<'info> {
    #[account(mut)]
    pub proposer_signer: Signer<'info>,

    #[account(
        constraint = proposer_identity.agent_key == proposer_signer.key() @ AapError::Unauthorized,
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

    /// The AgentIdentity of the party being added
    pub party_identity: Account<'info, AgentIdentity>,

    #[account(
        init,
        payer = proposer_signer,
        space = AgreementParty::LEN,
        seeds = [b"party", agreement_id.as_ref(), party_identity.key().as_ref()],
        bump,
    )]
    pub party: Account<'info, AgreementParty>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddParty>,
    agreement_id: [u8; 16],
    role: u8,
) -> Result<()> {
    // Validate party count
    require!(
        ctx.accounts.agreement.parties_added < ctx.accounts.agreement.num_parties,
        AapError::MaxPartiesExceeded
    );

    // Validate role
    require!(role <= MAX_ROLE, AapError::InvalidRole);

    let agreement_key = ctx.accounts.agreement.key();
    let party_identity_key = ctx.accounts.party_identity.key();

    // Initialize party
    let party = &mut ctx.accounts.party;
    party.agreement = agreement_key;
    party.agent_identity = party_identity_key;
    party.role = role;
    party.signed = false;
    party.signed_at = 0;
    party.escrow_deposited = 0;
    party.bump = ctx.bumps.party;

    ctx.accounts.agreement.parties_added += 1;

    emit!(PartyAdded {
        agreement_id,
        party: ctx.accounts.party_identity.key(),
        role,
    });

    Ok(())
}

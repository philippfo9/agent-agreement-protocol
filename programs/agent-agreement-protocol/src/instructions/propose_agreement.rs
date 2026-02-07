use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::AapError;
use crate::events::AgreementProposed;
use crate::state::{AgentIdentity, Agreement, AgreementParty};

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct ProposeAgreement<'info> {
    #[account(mut)]
    pub proposer_signer: Signer<'info>,

    #[account(
        constraint = proposer_identity.agent_key == proposer_signer.key() @ AapError::Unauthorized,
    )]
    pub proposer_identity: Account<'info, AgentIdentity>,

    #[account(
        init,
        payer = proposer_signer,
        space = Agreement::LEN,
        seeds = [b"agreement", agreement_id.as_ref()],
        bump,
    )]
    pub agreement: Account<'info, Agreement>,

    #[account(
        init,
        payer = proposer_signer,
        space = AgreementParty::LEN,
        seeds = [b"party", agreement_id.as_ref(), proposer_identity.key().as_ref()],
        bump,
    )]
    pub proposer_party: Account<'info, AgreementParty>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ProposeAgreement>,
    agreement_id: [u8; 16],
    agreement_type: u8,
    visibility: u8,
    terms_hash: [u8; 32],
    terms_uri: [u8; 64],
    num_parties: u8,
    expires_at: i64,
) -> Result<()> {
    let identity = &ctx.accounts.proposer_identity;

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

    // Validate agreement type
    require!(
        agreement_type <= MAX_AGREEMENT_TYPE,
        AapError::InvalidAgreementType
    );

    // Validate visibility
    require!(
        visibility <= VISIBILITY_PRIVATE,
        AapError::InvalidVisibility
    );

    // Validate num_parties
    require!(
        num_parties >= MIN_PARTIES && num_parties <= MAX_PARTIES,
        AapError::InvalidPartyCount
    );

    let clock = Clock::get()?;

    // Initialize agreement
    let agreement = &mut ctx.accounts.agreement;
    agreement.agreement_id = agreement_id;
    agreement.agreement_type = agreement_type;
    agreement.status = STATUS_PROPOSED;
    agreement.visibility = visibility;
    agreement.proposer = ctx.accounts.proposer_identity.key();
    agreement.terms_hash = terms_hash;
    agreement.terms_uri = terms_uri;
    agreement.escrow_vault = Pubkey::default();
    agreement.escrow_mint = Pubkey::default();
    agreement.escrow_total = 0;
    agreement.num_parties = num_parties;
    agreement.num_signed = 1; // proposer auto-signs
    agreement.parties_added = 1; // proposer is added
    agreement.created_at = clock.unix_timestamp;
    agreement.expires_at = expires_at;
    agreement.bump = ctx.bumps.agreement;

    // Initialize proposer party
    let party = &mut ctx.accounts.proposer_party;
    party.agreement = ctx.accounts.agreement.key();
    party.agent_identity = ctx.accounts.proposer_identity.key();
    party.role = ROLE_PROPOSER;
    party.signed = true;
    party.signed_at = clock.unix_timestamp;
    party.escrow_deposited = 0;
    party.bump = ctx.bumps.proposer_party;

    emit!(AgreementProposed {
        agreement_id,
        proposer: ctx.accounts.proposer_identity.key(),
        agreement_pda: ctx.accounts.agreement.key(),
    });

    Ok(())
}

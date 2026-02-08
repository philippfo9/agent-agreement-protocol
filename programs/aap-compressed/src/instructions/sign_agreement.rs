use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{account_meta::CompressedAccountMeta, ValidityProof},
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::constants::*;
use crate::errors::AapError;
use crate::state::{CompressedAgentIdentity, CompressedAgreement, CompressedAgreementParty};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct SignAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, SignAgreement<'info>>,
    proof: ValidityProof,
    // Signer's compressed identity (read-only for auth)
    signer_identity_meta: CompressedAccountMeta,
    signer_identity: CompressedAgentIdentity,
    // The agreement to update
    agreement_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
    // The party record to update
    party_meta: CompressedAccountMeta,
    current_party: CompressedAgreementParty,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be the identity's agent_key
    require!(signer_identity.agent_key == signer_key, AapError::Unauthorized);

    // Validate delegation
    if signer_identity.scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            signer_identity.scope.expires_at > clock.unix_timestamp,
            AapError::DelegationExpired
        );
    }
    require!(
        signer_identity.scope.can_sign_agreements,
        AapError::CannotSignAgreements
    );

    // Agreement must be in Proposed status
    require!(current_agreement.status == STATUS_PROPOSED, AapError::InvalidStatus);

    // Check agreement expiry
    if current_agreement.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            current_agreement.expires_at > clock.unix_timestamp,
            AapError::AgreementExpired
        );
    }

    // Party must not have already signed
    require!(!current_party.signed, AapError::AlreadySigned);

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    invoke_sign_cpi(
        proof,
        signer_identity_meta,
        signer_identity,
        agreement_meta,
        current_agreement,
        party_meta,
        current_party,
        light_cpi_accounts,
    )
}

#[inline(never)]
fn invoke_sign_cpi<'info>(
    proof: ValidityProof,
    signer_identity_meta: CompressedAccountMeta,
    signer_identity: CompressedAgentIdentity,
    agreement_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
    party_meta: CompressedAccountMeta,
    current_party: CompressedAgreementParty,
    light_cpi_accounts: CpiAccounts<'_, 'info>,
) -> Result<()> {
    let clock = Clock::get()?;

    let identity = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &signer_identity_meta,
        signer_identity,
    )?;

    let mut agreement = LightAccount::<CompressedAgreement>::new_mut(
        &crate::ID,
        &agreement_meta,
        current_agreement.clone(),
    )?;
    agreement.num_signed += 1;
    if agreement.num_signed == agreement.num_parties {
        agreement.status = STATUS_ACTIVE;
    }

    let mut party = LightAccount::<CompressedAgreementParty>::new_mut(
        &crate::ID,
        &party_meta,
        current_party,
    )?;
    party.signed = true;
    party.signed_at = clock.unix_timestamp;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .with_light_account(agreement)?
        .with_light_account(party)?
        .invoke(light_cpi_accounts)?;

    msg!("Agreement signed");
    Ok(())
}

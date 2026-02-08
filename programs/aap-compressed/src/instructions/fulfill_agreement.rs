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
pub struct FulfillAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, FulfillAgreement<'info>>,
    proof: ValidityProof,
    // Signer's identity for auth
    signer_identity_meta: CompressedAccountMeta,
    signer_identity: CompressedAgentIdentity,
    // Signer's party record to prove membership
    signer_party_meta: CompressedAccountMeta,
    signer_party: CompressedAgreementParty,
    // The agreement to fulfill
    agreement_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be agent_key or authority
    require!(
        signer_identity.agent_key == signer_key
            || signer_identity.authority == signer_key,
        AapError::Unauthorized
    );

    // Agreement must be Active
    require!(current_agreement.status == STATUS_ACTIVE, AapError::InvalidStatus);

    // Pass-through identity and party
    let identity = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &signer_identity_meta,
        signer_identity,
    )?;

    let party = LightAccount::<CompressedAgreementParty>::new_mut(
        &crate::ID,
        &signer_party_meta,
        signer_party,
    )?;

    // Mutate agreement status to Fulfilled
    let mut agreement = LightAccount::<CompressedAgreement>::new_mut(
        &crate::ID,
        &agreement_meta,
        current_agreement,
    )?;
    agreement.status = STATUS_FULFILLED;

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .with_light_account(party)?
        .with_light_account(agreement)?
        .invoke(light_cpi_accounts)?;

    msg!("Agreement fulfilled");
    Ok(())
}

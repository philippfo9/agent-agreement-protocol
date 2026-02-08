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
pub struct CloseAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseAgreement<'info>>,
    proof: ValidityProof,
    // Signer's identity for auth
    signer_identity_meta: CompressedAccountMeta,
    signer_identity: CompressedAgentIdentity,
    // Signer's party record (will be closed)
    signer_party_meta: CompressedAccountMeta,
    signer_party: CompressedAgreementParty,
    // The agreement (will be closed)
    agreement_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be the authority of the identity
    require!(signer_identity.authority == signer_key, AapError::Unauthorized);

    // Agreement must be in a terminal state
    require!(
        current_agreement.status == STATUS_FULFILLED
            || current_agreement.status == STATUS_CANCELLED
            || current_agreement.status == STATUS_BREACHED,
        AapError::InvalidStatus
    );

    // Pass-through identity (unchanged)
    let identity = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &signer_identity_meta,
        signer_identity,
    )?;

    // Close party and agreement
    let party = LightAccount::<CompressedAgreementParty>::new_close(
        &crate::ID,
        &signer_party_meta,
        signer_party,
    )?;

    let agreement = LightAccount::<CompressedAgreement>::new_close(
        &crate::ID,
        &agreement_meta,
        current_agreement,
    )?;

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

    msg!("Compressed agreement closed");
    Ok(())
}

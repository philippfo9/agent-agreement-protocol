use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{account_meta::CompressedAccountMeta, ValidityProof},
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::constants::*;
use crate::errors::AapError;
use crate::state::{CompressedAgentIdentity, CompressedAgreement};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct CancelAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelAgreement<'info>>,
    proof: ValidityProof,
    // Proposer's identity for auth
    proposer_identity_meta: CompressedAccountMeta,
    proposer_identity: CompressedAgentIdentity,
    // The agreement to cancel
    agreement_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be agent_key or authority of the proposer identity
    require!(
        proposer_identity.agent_key == signer_key
            || proposer_identity.authority == signer_key,
        AapError::Unauthorized
    );

    // Agreement's proposer must match the provided identity
    require!(
        current_agreement.proposer == Pubkey::from(proposer_identity_meta.address),
        AapError::Unauthorized
    );

    // Agreement must be in Proposed status
    require!(current_agreement.status == STATUS_PROPOSED, AapError::InvalidStatus);

    // Pass-through proposer identity
    let identity = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &proposer_identity_meta,
        proposer_identity,
    )?;

    // Mutate agreement status to Cancelled
    let mut agreement = LightAccount::<CompressedAgreement>::new_mut(
        &crate::ID,
        &agreement_meta,
        current_agreement,
    )?;
    agreement.status = STATUS_CANCELLED;

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .with_light_account(agreement)?
        .invoke(light_cpi_accounts)?;

    msg!("Agreement cancelled");
    Ok(())
}

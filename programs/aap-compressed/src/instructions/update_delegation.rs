use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{account_meta::CompressedAccountMeta, ValidityProof},
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::errors::AapError;
use crate::state::{CompressedAgentIdentity, CompressedDelegationScope};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct UpdateDelegation<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateDelegation<'info>>,
    proof: ValidityProof,
    account_meta: CompressedAccountMeta,
    current_identity: CompressedAgentIdentity,
    new_scope: CompressedDelegationScope,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Only authority can update delegation
    require!(current_identity.authority == signer_key, AapError::Unauthorized);

    // Validate new scope expiration
    if new_scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(new_scope.expires_at > clock.unix_timestamp, AapError::ScopeExpired);
    }

    let mut identity = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &account_meta,
        current_identity,
    )?;

    identity.scope = new_scope;

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .invoke(light_cpi_accounts)?;

    msg!("Delegation updated");
    Ok(())
}

use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{account_meta::CompressedAccountMeta, ValidityProof},
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::errors::AapError;
use crate::state::CompressedAgentIdentity;
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct RevokeAgent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, RevokeAgent<'info>>,
    proof: ValidityProof,
    account_meta: CompressedAccountMeta,
    current_identity: CompressedAgentIdentity,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Only authority can revoke
    require!(current_identity.authority == signer_key, AapError::Unauthorized);

    // Close the compressed account (nullify the leaf, no output)
    let identity = LightAccount::<CompressedAgentIdentity>::new_close(
        &crate::ID,
        &account_meta,
        current_identity,
    )?;

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .invoke(light_cpi_accounts)?;

    msg!("Compressed agent revoked");
    Ok(())
}

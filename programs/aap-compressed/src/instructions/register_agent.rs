use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{PackedAddressTreeInfo, ValidityProof},
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::errors::AapError;
use crate::state::{CompressedAgentIdentity, CompressedDelegationScope};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, RegisterAgent<'info>>,
    proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    agent_key: [u8; 32],
    metadata_hash: [u8; 32],
    scope: CompressedDelegationScope,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let agent_pubkey = Pubkey::from(agent_key);

    // Agent key must differ from authority
    require!(agent_pubkey != signer_key, AapError::AgentKeyEqualsAuthority);

    // Validate scope expiration
    if scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(scope.expires_at > clock.unix_timestamp, AapError::ScopeExpired);
    }

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    // Resolve address tree pubkey (validated by Light system program CPI)
    let address_tree_pubkey = address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(|_| ErrorCode::AccountNotEnoughKeys)?;

    // Derive compressed address: seeds = ["agent", agent_key]
    let (address, address_seed) = derive_address(
        &[b"agent", &agent_key],
        &address_tree_pubkey,
        &crate::ID,
    );

    let clock = Clock::get()?;

    let mut identity = LightAccount::<CompressedAgentIdentity>::new_init(
        &crate::ID,
        Some(address),
        output_state_tree_index,
    );

    identity.authority = signer_key;
    identity.agent_key = agent_pubkey;
    identity.metadata_hash = metadata_hash;
    identity.scope = scope;
    identity.parent = Pubkey::default();
    identity.created_at = clock.unix_timestamp;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(identity)?
        .with_new_addresses(&[
            address_tree_info.into_new_address_params_assigned_packed(address_seed, Some(0)),
        ])
        .invoke(light_cpi_accounts)?;

    msg!("Compressed agent registered");
    Ok(())
}

use anchor_lang::prelude::*;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::v2::{CpiAccounts, LightSystemProgramCpi},
    instruction::{
        account_meta::CompressedAccountMeta, PackedAddressTreeInfo, ValidityProof,
    },
};
use light_sdk::cpi::{LightCpiInstruction, InvokeLightSystemProgram};

use crate::errors::AapError;
use crate::state::{CompressedAgentIdentity, CompressedDelegationScope};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct RegisterSubAgent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, RegisterSubAgent<'info>>,
    proof: ValidityProof,
    parent_account_meta: CompressedAccountMeta,
    parent_identity: CompressedAgentIdentity,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    sub_agent_key: [u8; 32],
    metadata_hash: [u8; 32],
    scope: CompressedDelegationScope,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be the parent's agent_key
    require!(parent_identity.agent_key == signer_key, AapError::Unauthorized);

    // Parent must not be a sub-agent itself (max 2 levels)
    require!(
        parent_identity.parent == Pubkey::default(),
        AapError::MaxDelegationDepth
    );

    // Parent delegation must not be expired
    if parent_identity.scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            parent_identity.scope.expires_at > clock.unix_timestamp,
            AapError::DelegationExpired
        );
    }

    // Sub-agent scope cannot exceed parent scope
    if !parent_identity.scope.can_sign_agreements {
        require!(!scope.can_sign_agreements, AapError::SubAgentScopeExceedsParent);
    }
    if parent_identity.scope.can_commit_funds {
        if parent_identity.scope.max_commit_lamports > 0 {
            require!(
                scope.max_commit_lamports <= parent_identity.scope.max_commit_lamports,
                AapError::SubAgentScopeExceedsParent
            );
        }
    } else {
        require!(!scope.can_commit_funds, AapError::SubAgentScopeExceedsParent);
    }

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

    // Derive compressed address for sub-agent
    let (address, address_seed) = derive_address(
        &[b"agent", &sub_agent_key],
        &address_tree_pubkey,
        &crate::ID,
    );

    // Read parent (verify it exists and hash matches proof) — read-only via new_mut
    // We need to include the parent in the CPI so the proof covers it
    let parent = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &parent_account_meta,
        parent_identity.clone(),
    )?;

    let clock = Clock::get()?;

    let mut sub_identity = LightAccount::<CompressedAgentIdentity>::new_init(
        &crate::ID,
        Some(address),
        output_state_tree_index,
    );

    sub_identity.authority = parent_identity.authority;
    sub_identity.agent_key = Pubkey::from(sub_agent_key);
    sub_identity.metadata_hash = metadata_hash;
    sub_identity.scope = scope;
    sub_identity.parent = Pubkey::from(parent_account_meta.address);
    sub_identity.created_at = clock.unix_timestamp;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(parent)?         // pass-through (unchanged)
        .with_light_account(sub_identity)?   // new account
        .with_new_addresses(&[
            address_tree_info.into_new_address_params_assigned_packed(address_seed, Some(1)),
        ])
        .invoke(light_cpi_accounts)?;

    msg!("Compressed sub-agent registered");
    Ok(())
}

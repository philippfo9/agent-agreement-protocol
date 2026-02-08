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
use light_sdk::constants::ADDRESS_TREE_V2;

use crate::constants::*;
use crate::errors::AapError;
use crate::state::{
    CompressedAgentIdentity, CompressedAgreement, CompressedAgreementParty,
};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
pub struct AddParty<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, AddParty<'info>>,
    proof: ValidityProof,
    // Proposer's compressed identity (read-only for auth check)
    proposer_account_meta: CompressedAccountMeta,
    proposer_identity: CompressedAgentIdentity,
    // The agreement to update
    agreement_account_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
    // The new party's identity (read-only, proves it exists)
    party_identity_account_meta: CompressedAccountMeta,
    party_identity: CompressedAgentIdentity,
    // Address tree for creating the party account
    party_address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    role: u8,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be proposer's agent_key
    require!(proposer_identity.agent_key == signer_key, AapError::Unauthorized);

    // Agreement must be in Proposed status
    require!(current_agreement.status == STATUS_PROPOSED, AapError::InvalidStatus);

    // Proposer must match agreement's proposer
    require!(
        current_agreement.proposer == Pubkey::from(proposer_account_meta.address),
        AapError::Unauthorized
    );

    // Validate party count
    require!(
        current_agreement.parties_added < current_agreement.num_parties,
        AapError::MaxPartiesExceeded
    );

    // Validate role
    require!(role <= MAX_ROLE, AapError::InvalidRole);

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    // Validate address tree
    let address_tree_pubkey = party_address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(|_| ErrorCode::AccountNotEnoughKeys)?;
    if address_tree_pubkey.to_bytes() != ADDRESS_TREE_V2 {
        return Err(AapError::InvalidAddressTree.into());
    }

    // Derive party address
    let (party_address, party_address_seed) = derive_address(
        &[
            b"party",
            &current_agreement.agreement_id,
            &party_identity_account_meta.address,
        ],
        &address_tree_pubkey,
        &crate::ID,
    );

    // Pass-through proposer identity (unchanged)
    let proposer = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &proposer_account_meta,
        proposer_identity,
    )?;

    // Pass-through party identity (unchanged)
    let party_id = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &party_identity_account_meta,
        party_identity,
    )?;

    // Mutate agreement (increment parties_added)
    let mut agreement = LightAccount::<CompressedAgreement>::new_mut(
        &crate::ID,
        &agreement_account_meta,
        current_agreement,
    )?;
    agreement.parties_added += 1;

    // Create new party
    let mut party = LightAccount::<CompressedAgreementParty>::new_init(
        &crate::ID,
        Some(party_address),
        output_state_tree_index,
    );
    party.agreement_address = agreement_account_meta.address;
    party.agent_identity_address = party_identity_account_meta.address;
    party.role = role;
    party.signed = false;
    party.signed_at = 0;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(proposer)?
        .with_light_account(party_id)?
        .with_light_account(agreement)?
        .with_light_account(party)?
        .with_new_addresses(&[
            party_address_tree_info
                .into_new_address_params_assigned_packed(party_address_seed, Some(3)),
        ])
        .invoke(light_cpi_accounts)?;

    msg!("Party added to compressed agreement");
    Ok(())
}

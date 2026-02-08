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
    proposer_account_meta: CompressedAccountMeta,
    proposer_identity: CompressedAgentIdentity,
    agreement_account_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
    party_identity_account_meta: CompressedAccountMeta,
    party_identity: CompressedAgentIdentity,
    party_address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    role: u8,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!(proposer_identity.agent_key == signer_key, AapError::Unauthorized);
    require!(current_agreement.status == STATUS_PROPOSED, AapError::InvalidStatus);
    require!(
        current_agreement.proposer == Pubkey::from(proposer_account_meta.address),
        AapError::Unauthorized
    );
    require!(
        current_agreement.parties_added < current_agreement.num_parties,
        AapError::MaxPartiesExceeded
    );
    require!(role <= MAX_ROLE, AapError::InvalidRole);

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    let address_tree_pubkey = party_address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(|_| ErrorCode::AccountNotEnoughKeys)?;

    let (party_address, party_address_seed) = derive_address(
        &[
            b"party",
            &current_agreement.agreement_id,
            &party_identity_account_meta.address,
        ],
        &address_tree_pubkey,
        &crate::ID,
    );

    build_accounts_and_invoke(
        proof,
        proposer_account_meta,
        proposer_identity,
        agreement_account_meta,
        current_agreement,
        party_identity_account_meta,
        party_identity,
        party_address_tree_info,
        output_state_tree_index,
        role,
        party_address,
        party_address_seed,
        light_cpi_accounts,
    )
}

#[inline(never)]
fn build_accounts_and_invoke<'info>(
    proof: ValidityProof,
    proposer_account_meta: CompressedAccountMeta,
    proposer_identity: CompressedAgentIdentity,
    agreement_account_meta: CompressedAccountMeta,
    current_agreement: CompressedAgreement,
    party_identity_account_meta: CompressedAccountMeta,
    party_identity: CompressedAgentIdentity,
    party_address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    role: u8,
    party_address: [u8; 32],
    party_address_seed: light_sdk::address::AddressSeed,
    light_cpi_accounts: CpiAccounts<'_, 'info>,
) -> Result<()> {
    let proposer = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &proposer_account_meta,
        proposer_identity,
    )?;

    let party_id = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &party_identity_account_meta,
        party_identity,
    )?;

    let mut agreement = LightAccount::<CompressedAgreement>::new_mut(
        &crate::ID,
        &agreement_account_meta,
        current_agreement,
    )?;
    agreement.parties_added += 1;

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

    invoke_cpi(
        proof,
        proposer,
        party_id,
        agreement,
        party,
        party_address_tree_info,
        party_address_seed,
        light_cpi_accounts,
    )
}

#[inline(never)]
fn invoke_cpi<'info>(
    proof: ValidityProof,
    proposer: LightAccount<CompressedAgentIdentity>,
    party_id: LightAccount<CompressedAgentIdentity>,
    agreement: LightAccount<CompressedAgreement>,
    party: LightAccount<CompressedAgreementParty>,
    party_address_tree_info: PackedAddressTreeInfo,
    party_address_seed: light_sdk::address::AddressSeed,
    light_cpi_accounts: CpiAccounts<'_, 'info>,
) -> Result<()> {
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

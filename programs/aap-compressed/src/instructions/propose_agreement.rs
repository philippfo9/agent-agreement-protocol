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
pub struct ProposeAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ProposeAgreement<'info>>,
    proof: ValidityProof,
    // The proposer's compressed AgentIdentity (read-only, passed for proof verification)
    proposer_account_meta: CompressedAccountMeta,
    proposer_identity: CompressedAgentIdentity,
    // Address tree for creating the two new compressed accounts
    agreement_address_tree_info: PackedAddressTreeInfo,
    party_address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    // Agreement params
    agreement_id: [u8; 16],
    agreement_type: u8,
    visibility: u8,
    terms_hash: [u8; 32],
    terms_uri: [u8; 64],
    num_parties: u8,
    expires_at: i64,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    // Signer must be the agent_key of the proposer identity
    require!(proposer_identity.agent_key == signer_key, AapError::Unauthorized);

    // Validate delegation
    if proposer_identity.scope.expires_at != 0 {
        let clock = Clock::get()?;
        require!(
            proposer_identity.scope.expires_at > clock.unix_timestamp,
            AapError::DelegationExpired
        );
    }
    require!(
        proposer_identity.scope.can_sign_agreements,
        AapError::CannotSignAgreements
    );

    // Validate params
    require!(agreement_type <= MAX_AGREEMENT_TYPE, AapError::InvalidAgreementType);
    require!(visibility <= VISIBILITY_PRIVATE, AapError::InvalidVisibility);
    require!(
        num_parties >= MIN_PARTIES && num_parties <= MAX_PARTIES,
        AapError::InvalidPartyCount
    );

    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.signer.as_ref(),
        ctx.remaining_accounts,
        crate::LIGHT_CPI_SIGNER,
    );

    // Validate address tree
    let address_tree_pubkey = agreement_address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(|_| ErrorCode::AccountNotEnoughKeys)?;
    if address_tree_pubkey.to_bytes() != ADDRESS_TREE_V2 {
        return Err(AapError::InvalidAddressTree.into());
    }

    // Derive agreement address: seeds = ["agreement", agreement_id]
    let (agreement_address, agreement_address_seed) = derive_address(
        &[b"agreement", &agreement_id],
        &address_tree_pubkey,
        &crate::ID,
    );

    // Derive party address: seeds = ["party", agreement_id, proposer_identity_address]
    let (party_address, party_address_seed) = derive_address(
        &[b"party", &agreement_id, &proposer_account_meta.address],
        &address_tree_pubkey,
        &crate::ID,
    );

    let clock = Clock::get()?;

    // Pass-through the proposer identity (read-only, proves it exists)
    let proposer = LightAccount::<CompressedAgentIdentity>::new_mut(
        &crate::ID,
        &proposer_account_meta,
        proposer_identity.clone(),
    )?;

    // Create compressed agreement
    let mut agreement = LightAccount::<CompressedAgreement>::new_init(
        &crate::ID,
        Some(agreement_address),
        output_state_tree_index,
    );
    agreement.agreement_id = agreement_id;
    agreement.agreement_type = agreement_type;
    agreement.status = STATUS_PROPOSED;
    agreement.visibility = visibility;
    agreement.proposer = Pubkey::from(proposer_account_meta.address);
    agreement.terms_hash = terms_hash;
    agreement.terms_uri = terms_uri;
    agreement.num_parties = num_parties;
    agreement.num_signed = 1; // proposer auto-signs
    agreement.parties_added = 1;
    agreement.created_at = clock.unix_timestamp;
    agreement.expires_at = expires_at;

    // Create compressed proposer party
    let mut proposer_party = LightAccount::<CompressedAgreementParty>::new_init(
        &crate::ID,
        Some(party_address),
        output_state_tree_index,
    );
    proposer_party.agreement_address = agreement_address;
    proposer_party.agent_identity_address = proposer_account_meta.address;
    proposer_party.role = ROLE_PROPOSER;
    proposer_party.signed = true;
    proposer_party.signed_at = clock.unix_timestamp;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(proposer)?          // read-only pass-through
        .with_light_account(agreement)?         // new
        .with_light_account(proposer_party)?    // new
        .with_new_addresses(&[
            agreement_address_tree_info
                .into_new_address_params_assigned_packed(agreement_address_seed, Some(1)),
            party_address_tree_info
                .into_new_address_params_assigned_packed(party_address_seed, Some(2)),
        ])
        .invoke(light_cpi_accounts)?;

    msg!("Compressed agreement proposed");
    Ok(())
}

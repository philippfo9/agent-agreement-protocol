#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use light_sdk::{cpi::CpiSigner, derive_light_cpi_signer};

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

// Re-export instruction account structs at crate root (required by Anchor 0.31.x #[program] macro)
pub use instructions::register_agent::*;
pub use instructions::update_delegation::*;
pub use instructions::register_sub_agent::*;
pub use instructions::revoke_agent::*;
pub use instructions::propose_agreement::*;
pub use instructions::add_party::*;
pub use instructions::sign_agreement::*;
pub use instructions::cancel_agreement::*;
pub use instructions::fulfill_agreement::*;
pub use instructions::close_agreement::*;

pub use state::{CompressedAgentIdentity, CompressedDelegationScope, CompressedAgreement, CompressedAgreementParty};

// Re-export light-sdk types at crate root (required by Anchor 0.31.x #[program] macro expansion)
pub use light_sdk::instruction::{
    account_meta::CompressedAccountMeta, PackedAddressTreeInfo, ValidityProof,
};

declare_id!("CmPr5AEFxgHVZnDAbPr5RCDHm8d7bJjhXDqRTmFSCVkW");

pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("CmPr5AEFxgHVZnDAbPr5RCDHm8d7bJjhXDqRTmFSCVkW");

#[program]
pub mod aap_compressed {
    use super::*;
    use light_sdk::instruction::{
        account_meta::CompressedAccountMeta, PackedAddressTreeInfo, ValidityProof,
    };

    pub fn register_agent<'info>(
        ctx: Context<'_, '_, '_, 'info, RegisterAgent<'info>>,
        proof: ValidityProof,
        address_tree_info: PackedAddressTreeInfo,
        output_state_tree_index: u8,
        agent_key: [u8; 32],
        metadata_hash: [u8; 32],
        scope: CompressedDelegationScope,
    ) -> Result<()> {
        instructions::register_agent::handler(
            ctx, proof, address_tree_info, output_state_tree_index,
            agent_key, metadata_hash, scope,
        )
    }

    pub fn update_delegation<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateDelegation<'info>>,
        proof: ValidityProof,
        account_meta: CompressedAccountMeta,
        current_identity: CompressedAgentIdentity,
        new_scope: CompressedDelegationScope,
    ) -> Result<()> {
        instructions::update_delegation::handler(
            ctx, proof, account_meta, current_identity, new_scope,
        )
    }

    pub fn register_sub_agent<'info>(
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
        instructions::register_sub_agent::handler(
            ctx, proof, parent_account_meta, parent_identity,
            address_tree_info, output_state_tree_index,
            sub_agent_key, metadata_hash, scope,
        )
    }

    pub fn revoke_agent<'info>(
        ctx: Context<'_, '_, '_, 'info, RevokeAgent<'info>>,
        proof: ValidityProof,
        account_meta: CompressedAccountMeta,
        current_identity: CompressedAgentIdentity,
    ) -> Result<()> {
        instructions::revoke_agent::handler(ctx, proof, account_meta, current_identity)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn propose_agreement<'info>(
        ctx: Context<'_, '_, '_, 'info, ProposeAgreement<'info>>,
        proof: ValidityProof,
        proposer_account_meta: CompressedAccountMeta,
        proposer_identity: CompressedAgentIdentity,
        agreement_address_tree_info: PackedAddressTreeInfo,
        party_address_tree_info: PackedAddressTreeInfo,
        output_state_tree_index: u8,
        agreement_id: [u8; 16],
        agreement_type: u8,
        visibility: u8,
        terms_hash: [u8; 32],
        terms_uri: [u8; 64],
        num_parties: u8,
        expires_at: i64,
    ) -> Result<()> {
        instructions::propose_agreement::handler(
            ctx, proof, proposer_account_meta, proposer_identity,
            agreement_address_tree_info, party_address_tree_info,
            output_state_tree_index, agreement_id, agreement_type,
            visibility, terms_hash, terms_uri, num_parties, expires_at,
        )
    }

    pub fn add_party<'info>(
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
        instructions::add_party::handler(
            ctx, proof, proposer_account_meta, proposer_identity,
            agreement_account_meta, current_agreement,
            party_identity_account_meta, party_identity,
            party_address_tree_info, output_state_tree_index, role,
        )
    }

    pub fn sign_agreement<'info>(
        ctx: Context<'_, '_, '_, 'info, SignAgreement<'info>>,
        proof: ValidityProof,
        signer_identity_meta: CompressedAccountMeta,
        signer_identity: CompressedAgentIdentity,
        agreement_meta: CompressedAccountMeta,
        current_agreement: CompressedAgreement,
        party_meta: CompressedAccountMeta,
        current_party: CompressedAgreementParty,
    ) -> Result<()> {
        instructions::sign_agreement::handler(
            ctx, proof, signer_identity_meta, signer_identity,
            agreement_meta, current_agreement, party_meta, current_party,
        )
    }

    pub fn cancel_agreement<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelAgreement<'info>>,
        proof: ValidityProof,
        proposer_identity_meta: CompressedAccountMeta,
        proposer_identity: CompressedAgentIdentity,
        agreement_meta: CompressedAccountMeta,
        current_agreement: CompressedAgreement,
    ) -> Result<()> {
        instructions::cancel_agreement::handler(
            ctx, proof, proposer_identity_meta, proposer_identity,
            agreement_meta, current_agreement,
        )
    }

    pub fn fulfill_agreement<'info>(
        ctx: Context<'_, '_, '_, 'info, FulfillAgreement<'info>>,
        proof: ValidityProof,
        signer_identity_meta: CompressedAccountMeta,
        signer_identity: CompressedAgentIdentity,
        signer_party_meta: CompressedAccountMeta,
        signer_party: CompressedAgreementParty,
        agreement_meta: CompressedAccountMeta,
        current_agreement: CompressedAgreement,
    ) -> Result<()> {
        instructions::fulfill_agreement::handler(
            ctx, proof, signer_identity_meta, signer_identity,
            signer_party_meta, signer_party, agreement_meta, current_agreement,
        )
    }

    pub fn close_agreement<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseAgreement<'info>>,
        proof: ValidityProof,
        signer_identity_meta: CompressedAccountMeta,
        signer_identity: CompressedAgentIdentity,
        signer_party_meta: CompressedAccountMeta,
        signer_party: CompressedAgreementParty,
        agreement_meta: CompressedAccountMeta,
        current_agreement: CompressedAgreement,
    ) -> Result<()> {
        instructions::close_agreement::handler(
            ctx, proof, signer_identity_meta, signer_identity,
            signer_party_meta, signer_party, agreement_meta, current_agreement,
        )
    }
}

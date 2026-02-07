use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::DelegationScope;

declare_id!("4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe");

#[program]
pub mod agent_agreement_protocol {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_key: Pubkey,
        metadata_hash: [u8; 32],
        scope: DelegationScope,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, agent_key, metadata_hash, scope)
    }

    pub fn update_delegation(
        ctx: Context<UpdateDelegation>,
        new_scope: DelegationScope,
    ) -> Result<()> {
        instructions::update_delegation::handler(ctx, new_scope)
    }

    pub fn register_sub_agent(
        ctx: Context<RegisterSubAgent>,
        sub_agent_key: Pubkey,
        metadata_hash: [u8; 32],
        scope: DelegationScope,
    ) -> Result<()> {
        instructions::register_sub_agent::handler(ctx, sub_agent_key, metadata_hash, scope)
    }

    pub fn revoke_agent(ctx: Context<RevokeAgent>) -> Result<()> {
        instructions::revoke_agent::handler(ctx)
    }

    pub fn propose_agreement(
        ctx: Context<ProposeAgreement>,
        agreement_id: [u8; 16],
        agreement_type: u8,
        visibility: u8,
        terms_hash: [u8; 32],
        terms_uri: [u8; 64],
        num_parties: u8,
        expires_at: i64,
    ) -> Result<()> {
        instructions::propose_agreement::handler(
            ctx,
            agreement_id,
            agreement_type,
            visibility,
            terms_hash,
            terms_uri,
            num_parties,
            expires_at,
        )
    }

    pub fn add_party(
        ctx: Context<AddParty>,
        agreement_id: [u8; 16],
        role: u8,
    ) -> Result<()> {
        instructions::add_party::handler(ctx, agreement_id, role)
    }

    pub fn sign_agreement(
        ctx: Context<SignAgreement>,
        agreement_id: [u8; 16],
    ) -> Result<()> {
        instructions::sign_agreement::handler(ctx, agreement_id)
    }

    pub fn cancel_agreement(
        ctx: Context<CancelAgreement>,
        agreement_id: [u8; 16],
    ) -> Result<()> {
        instructions::cancel_agreement::handler(ctx, agreement_id)
    }

    pub fn fulfill_agreement(
        ctx: Context<FulfillAgreement>,
        agreement_id: [u8; 16],
    ) -> Result<()> {
        instructions::fulfill_agreement::handler(ctx, agreement_id)
    }

    pub fn close_agreement(
        ctx: Context<CloseAgreement>,
        agreement_id: [u8; 16],
    ) -> Result<()> {
        instructions::close_agreement::handler(ctx, agreement_id)
    }
}

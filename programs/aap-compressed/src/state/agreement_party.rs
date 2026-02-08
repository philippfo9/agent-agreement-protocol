use anchor_lang::prelude::*;
use light_sdk::LightDiscriminator;

/// Compressed AgreementParty — same fields as V1 but stored as a compressed account.
/// No rent required.
#[derive(Clone, Debug, Default, LightDiscriminator, AnchorSerialize, AnchorDeserialize)]
pub struct CompressedAgreementParty {
    pub agreement_address: [u8; 32], // compressed address of the Agreement
    pub agent_identity_address: [u8; 32], // compressed address of the AgentIdentity
    pub role: u8,
    pub signed: bool,
    pub signed_at: i64,
}

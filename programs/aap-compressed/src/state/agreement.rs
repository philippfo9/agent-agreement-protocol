use anchor_lang::prelude::*;
use light_sdk::LightDiscriminator;

/// Compressed Agreement — same fields as V1 but stored as a compressed account.
/// No rent required.
#[derive(Clone, Debug, LightDiscriminator, AnchorSerialize, AnchorDeserialize)]
pub struct CompressedAgreement {
    pub agreement_id: [u8; 16],
    pub agreement_type: u8,
    pub status: u8,
    pub visibility: u8,
    pub proposer: Pubkey,
    pub terms_hash: [u8; 32],
    pub terms_uri: [u8; 64],
    pub num_parties: u8,
    pub num_signed: u8,
    pub parties_added: u8,
    pub created_at: i64,
    pub expires_at: i64,
}

impl Default for CompressedAgreement {
    fn default() -> Self {
        Self {
            agreement_id: [0u8; 16],
            agreement_type: 0,
            status: 0,
            visibility: 0,
            proposer: Pubkey::default(),
            terms_hash: [0u8; 32],
            terms_uri: [0u8; 64],
            num_parties: 0,
            num_signed: 0,
            parties_added: 0,
            created_at: 0,
            expires_at: 0,
        }
    }
}

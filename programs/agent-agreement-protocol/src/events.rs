use anchor_lang::prelude::*;

#[event]
pub struct AgentRegistered {
    pub authority: Pubkey,
    pub agent_key: Pubkey,
    pub agent_identity: Pubkey,
}

#[event]
pub struct AgentRevoked {
    pub authority: Pubkey,
    pub agent_key: Pubkey,
}

#[event]
pub struct DelegationUpdated {
    pub authority: Pubkey,
    pub agent_identity: Pubkey,
}

#[event]
pub struct AgreementProposed {
    pub agreement_id: [u8; 16],
    pub proposer: Pubkey,
    pub agreement_pda: Pubkey,
}

#[event]
pub struct PartyAdded {
    pub agreement_id: [u8; 16],
    pub party: Pubkey,
    pub role: u8,
}

#[event]
pub struct AgreementSigned {
    pub agreement_id: [u8; 16],
    pub party: Pubkey,
}

#[event]
pub struct AgreementActivated {
    pub agreement_id: [u8; 16],
}

#[event]
pub struct AgreementCancelled {
    pub agreement_id: [u8; 16],
}

#[event]
pub struct AgreementFulfilled {
    pub agreement_id: [u8; 16],
}

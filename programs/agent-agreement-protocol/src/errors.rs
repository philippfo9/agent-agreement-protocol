use anchor_lang::prelude::*;

#[error_code]
pub enum AapError {
    #[msg("Agent key must be different from authority")]
    AgentKeyEqualsAuthority,

    #[msg("Delegation scope has already expired")]
    ScopeExpired,

    #[msg("Unauthorized: signer is not the authority")]
    Unauthorized,

    #[msg("Agent delegation has expired")]
    DelegationExpired,

    #[msg("Agent does not have permission to sign agreements")]
    CannotSignAgreements,

    #[msg("Agent does not have permission to commit funds")]
    CannotCommitFunds,

    #[msg("Escrow amount exceeds delegation max_commit_lamports")]
    EscrowExceedsLimit,

    #[msg("Sub-agent scope cannot exceed parent scope")]
    SubAgentScopeExceedsParent,

    #[msg("Maximum delegation depth is 2 levels (human -> agent -> sub-agent)")]
    MaxDelegationDepth,

    #[msg("Invalid agreement type")]
    InvalidAgreementType,

    #[msg("Invalid visibility value")]
    InvalidVisibility,

    #[msg("Invalid party role")]
    InvalidRole,

    #[msg("Number of parties must be between 2 and 8")]
    InvalidPartyCount,

    #[msg("Agreement is not in the expected status")]
    InvalidStatus,

    #[msg("Agreement has expired")]
    AgreementExpired,

    #[msg("Party has already signed")]
    AlreadySigned,

    #[msg("Maximum number of parties already added")]
    MaxPartiesExceeded,

    #[msg("Escrow distribution does not sum to total")]
    EscrowDistributionMismatch,

    #[msg("Escrow has not been fully distributed")]
    EscrowNotDistributed,

    #[msg("Agent has active agreements and cannot be revoked")]
    AgentHasActiveAgreements,

    #[msg("Invalid amount: must be greater than zero")]
    InvalidAmount,

    #[msg("Insufficient vault balance for withdrawal")]
    InsufficientVaultBalance,
}

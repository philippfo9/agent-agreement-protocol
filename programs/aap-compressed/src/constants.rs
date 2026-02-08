// AgreementType
pub const AGREEMENT_TYPE_SAFE: u8 = 0;
pub const AGREEMENT_TYPE_SERVICE: u8 = 1;
pub const AGREEMENT_TYPE_REVENUE_SHARE: u8 = 2;
pub const AGREEMENT_TYPE_JOINT_VENTURE: u8 = 3;
pub const AGREEMENT_TYPE_CUSTOM: u8 = 4;

// AgreementStatus
pub const STATUS_PROPOSED: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;
pub const STATUS_FULFILLED: u8 = 2;
pub const STATUS_BREACHED: u8 = 3;
pub const STATUS_DISPUTED: u8 = 4;
pub const STATUS_CANCELLED: u8 = 5;

// Visibility
pub const VISIBILITY_PUBLIC: u8 = 0;
pub const VISIBILITY_PRIVATE: u8 = 1;

// PartyRole
pub const ROLE_PROPOSER: u8 = 0;
pub const ROLE_COUNTERPARTY: u8 = 1;
pub const ROLE_WITNESS: u8 = 2;
pub const ROLE_ARBITRATOR: u8 = 3;

// Limits
pub const MAX_PARTIES: u8 = 8;
pub const MIN_PARTIES: u8 = 2;
pub const MAX_AGREEMENT_TYPE: u8 = 4;
pub const MAX_ROLE: u8 = 3;

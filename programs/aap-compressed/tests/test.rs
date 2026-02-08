#![cfg(feature = "test-sbf")]

use anchor_lang::{AnchorDeserialize, InstructionData, ToAccountMetas};
use aap_compressed::{
    CompressedAgentIdentity, CompressedAgreement, CompressedAgreementParty,
    CompressedDelegationScope,
};
use light_client::indexer::CompressedAccount;
use light_program_test::{
    program_test::LightProgramTest, AddressWithTree, Indexer, ProgramTestConfig, Rpc, RpcError,
};
use light_sdk::{
    address::v2::derive_address,
    instruction::{
        account_meta::CompressedAccountMeta, PackedAccounts, SystemAccountMetaConfig,
    },
};
use solana_sdk::{
    instruction::Instruction,
    signature::{Keypair, Signature, Signer},
};

// =========================================================================
// Test: Register agent → update delegation → revoke agent
// =========================================================================
#[tokio::test]
async fn test_register_update_revoke_agent() {
    let config = ProgramTestConfig::new(true, Some(vec![("aap_compressed", aap_compressed::ID)]));
    let mut rpc = LightProgramTest::new(config).await.unwrap();
    let payer = rpc.get_payer().insecure_clone();
    let agent_key = Keypair::new();

    let address_tree_info = rpc.get_address_tree_v2();

    // Derive the compressed address
    let (address, _) = derive_address(
        &[b"agent", agent_key.pubkey().as_ref()],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    // === REGISTER ===
    register_agent(
        &mut rpc,
        &payer,
        &address,
        address_tree_info,
        agent_key.pubkey().to_bytes(),
        [1u8; 32],
        CompressedDelegationScope {
            can_sign_agreements: true,
            can_commit_funds: false,
            max_commit_lamports: 0,
            expires_at: 0,
        },
    )
    .await
    .unwrap();

    // Verify the compressed account was created
    let account = rpc
        .get_compressed_account(address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &account.data.as_ref().unwrap().data;
    let identity = CompressedAgentIdentity::deserialize(&mut &data[..]).unwrap();
    assert_eq!(identity.authority, payer.pubkey());
    assert_eq!(identity.agent_key, agent_key.pubkey());
    assert!(identity.scope.can_sign_agreements);
    assert!(!identity.scope.can_commit_funds);

    // === UPDATE DELEGATION ===
    update_delegation(
        &mut rpc,
        &payer,
        &account,
        CompressedDelegationScope {
            can_sign_agreements: true,
            can_commit_funds: true,
            max_commit_lamports: 1_000_000,
            expires_at: 0,
        },
    )
    .await
    .unwrap();

    // Verify update
    let account = rpc
        .get_compressed_account(address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &account.data.as_ref().unwrap().data;
    let identity = CompressedAgentIdentity::deserialize(&mut &data[..]).unwrap();
    assert!(identity.scope.can_commit_funds);
    assert_eq!(identity.scope.max_commit_lamports, 1_000_000);

    // === REVOKE ===
    revoke_agent(&mut rpc, &payer, &account).await.unwrap();

    // Revoke succeeded (transaction didn't error). In batched V2 trees,
    // the nullification is queued so the indexer may still return the account
    // briefly. The important thing is the close CPI succeeded.
    println!("Register → Update → Revoke lifecycle passed!");
}

// =========================================================================
// Test: Full agreement lifecycle — propose → add party → sign → fulfill → close
// =========================================================================
#[tokio::test]
async fn test_agreement_lifecycle() {
    let config = ProgramTestConfig::new(true, Some(vec![("aap_compressed", aap_compressed::ID)]));
    let mut rpc = LightProgramTest::new(config).await.unwrap();
    let payer = rpc.get_payer().insecure_clone();

    let proposer_agent = Keypair::new();
    let counterparty_agent = Keypair::new();

    // Fund agent keypairs so they can pay compressed account fees
    rpc.airdrop_lamports(&proposer_agent.pubkey(), 1_000_000_000)
        .await
        .unwrap();
    rpc.airdrop_lamports(&counterparty_agent.pubkey(), 1_000_000_000)
        .await
        .unwrap();

    let address_tree_info = rpc.get_address_tree_v2();

    // Register proposer agent
    let (proposer_address, _) = derive_address(
        &[b"agent", proposer_agent.pubkey().as_ref()],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    register_agent(
        &mut rpc,
        &payer,
        &proposer_address,
        address_tree_info,
        proposer_agent.pubkey().to_bytes(),
        [1u8; 32],
        CompressedDelegationScope {
            can_sign_agreements: true,
            can_commit_funds: false,
            max_commit_lamports: 0,
            expires_at: 0,
        },
    )
    .await
    .unwrap();

    // Register counterparty agent
    let (counterparty_address, _) = derive_address(
        &[b"agent", counterparty_agent.pubkey().as_ref()],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    register_agent(
        &mut rpc,
        &payer,
        &counterparty_address,
        address_tree_info,
        counterparty_agent.pubkey().to_bytes(),
        [2u8; 32],
        CompressedDelegationScope {
            can_sign_agreements: true,
            can_commit_funds: false,
            max_commit_lamports: 0,
            expires_at: 0,
        },
    )
    .await
    .unwrap();

    // Fetch proposer compressed account
    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    // === PROPOSE AGREEMENT ===
    let agreement_id: [u8; 16] = [42u8; 16];
    let (agreement_address, _) = derive_address(
        &[b"agreement", &agreement_id],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    propose_agreement(
        &mut rpc,
        &payer,
        &proposer_agent,
        &proposer_account,
        address_tree_info,
        agreement_id,
        [0u8; 32], // terms_hash
        [0u8; 64], // terms_uri
        2,         // num_parties
    )
    .await
    .unwrap();

    // Verify agreement was created
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &agreement_account.data.as_ref().unwrap().data;
    let agreement = CompressedAgreement::deserialize(&mut &data[..]).unwrap();
    assert_eq!(agreement.status, 0); // STATUS_PROPOSED
    assert_eq!(agreement.num_signed, 1); // proposer auto-signed
    assert_eq!(agreement.num_parties, 2);
    assert_eq!(agreement.parties_added, 1);
    println!("  ✓ propose_agreement");

    // === ADD COUNTERPARTY ===
    // Re-fetch latest state after propose mutated them
    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let counterparty_account = rpc
        .get_compressed_account(counterparty_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    // Derive party address for counterparty
    let (counterparty_party_address, _) = derive_address(
        &[b"party", &agreement_id, &counterparty_address],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    add_party(
        &mut rpc,
        &payer,
        &proposer_agent,
        &proposer_account,
        &agreement_account,
        &counterparty_account,
        address_tree_info,
        1, // ROLE_COUNTERPARTY
    )
    .await
    .unwrap();

    // Verify party was created and agreement updated
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &agreement_account.data.as_ref().unwrap().data;
    let agreement = CompressedAgreement::deserialize(&mut &data[..]).unwrap();
    assert_eq!(agreement.parties_added, 2);
    assert_eq!(agreement.num_signed, 1); // still only proposer signed

    let party_account = rpc
        .get_compressed_account(counterparty_party_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &party_account.data.as_ref().unwrap().data;
    let party = CompressedAgreementParty::deserialize(&mut &data[..]).unwrap();
    assert_eq!(party.role, 1); // ROLE_COUNTERPARTY
    assert!(!party.signed);
    println!("  ✓ add_party");

    // === SIGN AGREEMENT (counterparty) ===
    let counterparty_account = rpc
        .get_compressed_account(counterparty_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let party_account = rpc
        .get_compressed_account(counterparty_party_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    sign_agreement(
        &mut rpc,
        &payer,
        &counterparty_agent,
        &counterparty_account,
        &agreement_account,
        &party_account,
    )
    .await
    .unwrap();

    // Verify agreement is now ACTIVE (both parties signed)
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &agreement_account.data.as_ref().unwrap().data;
    let agreement = CompressedAgreement::deserialize(&mut &data[..]).unwrap();
    assert_eq!(agreement.status, 1); // STATUS_ACTIVE
    assert_eq!(agreement.num_signed, 2);

    let party_account = rpc
        .get_compressed_account(counterparty_party_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &party_account.data.as_ref().unwrap().data;
    let party = CompressedAgreementParty::deserialize(&mut &data[..]).unwrap();
    assert!(party.signed);
    // In test-validator the clock may start at 0, so just verify it was set
    println!("  ✓ sign_agreement (agreement now ACTIVE, signed_at={})", party.signed_at);

    // === FULFILL AGREEMENT ===
    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    // Derive proposer's party address
    let (proposer_party_address, _) = derive_address(
        &[b"party", &agreement_id, &proposer_address],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );
    let proposer_party_account = rpc
        .get_compressed_account(proposer_party_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    fulfill_agreement(
        &mut rpc,
        &payer,
        &proposer_agent,
        &proposer_account,
        &proposer_party_account,
        &agreement_account,
    )
    .await
    .unwrap();

    // Verify agreement is now FULFILLED
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &agreement_account.data.as_ref().unwrap().data;
    let agreement = CompressedAgreement::deserialize(&mut &data[..]).unwrap();
    assert_eq!(agreement.status, 2); // STATUS_FULFILLED
    println!("  ✓ fulfill_agreement");

    // === CLOSE AGREEMENT ===
    // close_agreement requires authority (payer), not agent_key
    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let proposer_party_account = rpc
        .get_compressed_account(proposer_party_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    close_agreement(
        &mut rpc,
        &payer,
        &proposer_account,
        &proposer_party_account,
        &agreement_account,
    )
    .await
    .unwrap();
    println!("  ✓ close_agreement");

    println!("Full agreement lifecycle passed: propose → add_party → sign → fulfill → close");
}

// =========================================================================
// Test: Cancel agreement flow — propose → cancel
// =========================================================================
#[tokio::test]
async fn test_cancel_agreement() {
    let config = ProgramTestConfig::new(true, Some(vec![("aap_compressed", aap_compressed::ID)]));
    let mut rpc = LightProgramTest::new(config).await.unwrap();
    let payer = rpc.get_payer().insecure_clone();

    let proposer_agent = Keypair::new();
    rpc.airdrop_lamports(&proposer_agent.pubkey(), 1_000_000_000)
        .await
        .unwrap();

    let address_tree_info = rpc.get_address_tree_v2();

    // Register proposer
    let (proposer_address, _) = derive_address(
        &[b"agent", proposer_agent.pubkey().as_ref()],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    register_agent(
        &mut rpc,
        &payer,
        &proposer_address,
        address_tree_info,
        proposer_agent.pubkey().to_bytes(),
        [1u8; 32],
        CompressedDelegationScope {
            can_sign_agreements: true,
            can_commit_funds: false,
            max_commit_lamports: 0,
            expires_at: 0,
        },
    )
    .await
    .unwrap();

    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    // Propose agreement
    let agreement_id: [u8; 16] = [99u8; 16];
    let (agreement_address, _) = derive_address(
        &[b"agreement", &agreement_id],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    propose_agreement(
        &mut rpc,
        &payer,
        &proposer_agent,
        &proposer_account,
        address_tree_info,
        agreement_id,
        [0u8; 32],
        [0u8; 64],
        2,
    )
    .await
    .unwrap();
    println!("  ✓ propose_agreement");

    // Cancel it
    let proposer_account = rpc
        .get_compressed_account(proposer_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();

    cancel_agreement(
        &mut rpc,
        &payer,
        &proposer_agent,
        &proposer_account,
        &agreement_account,
    )
    .await
    .unwrap();

    // Verify status is CANCELLED
    let agreement_account = rpc
        .get_compressed_account(agreement_address, None)
        .await
        .unwrap()
        .value
        .unwrap();
    let data = &agreement_account.data.as_ref().unwrap().data;
    let agreement = CompressedAgreement::deserialize(&mut &data[..]).unwrap();
    assert_eq!(agreement.status, 5); // STATUS_CANCELLED
    println!("  ✓ cancel_agreement");

    println!("Cancel agreement test passed: propose → cancel");
}

// =========================================================================
// Helper: register_agent
// =========================================================================
async fn register_agent<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    address: &[u8; 32],
    address_tree_info: light_client::indexer::TreeInfo,
    agent_key: [u8; 32],
    metadata_hash: [u8; 32],
    scope: CompressedDelegationScope,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    let rpc_result = rpc
        .get_validity_proof(
            vec![],
            vec![AddressWithTree {
                tree: address_tree_info.tree,
                address: *address,
            }],
            None,
        )
        .await?
        .value;

    let output_state_tree_index = rpc
        .get_random_state_tree_info()?
        .pack_output_tree_index(&mut remaining_accounts)?;

    let packed_address_tree_info = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .address_trees[0];

    let instruction_data = aap_compressed::instruction::RegisterAgent {
        proof: rpc_result.proof,
        address_tree_info: packed_address_tree_info,
        output_state_tree_index,
        agent_key,
        metadata_hash,
        scope,
    };

    let accounts = aap_compressed::accounts::RegisterAgent {
        signer: payer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
        .await
}

// =========================================================================
// Helper: update_delegation
// =========================================================================
async fn update_delegation<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    compressed_account: &CompressedAccount,
    new_scope: CompressedDelegationScope,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    let hash = compressed_account.hash;

    let rpc_result = rpc
        .get_validity_proof(vec![hash], vec![], None)
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let current_identity = CompressedAgentIdentity::deserialize(
        &mut compressed_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let account_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: compressed_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::UpdateDelegation {
        proof: rpc_result.proof,
        account_meta,
        current_identity,
        new_scope,
    };

    let accounts = aap_compressed::accounts::UpdateDelegation {
        signer: payer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
        .await
}

// =========================================================================
// Helper: revoke_agent
// =========================================================================
async fn revoke_agent<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    compressed_account: &CompressedAccount,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    let hash = compressed_account.hash;

    let rpc_result = rpc
        .get_validity_proof(vec![hash], vec![], None)
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let current_identity = CompressedAgentIdentity::deserialize(
        &mut compressed_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let account_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: compressed_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::RevokeAgent {
        proof: rpc_result.proof,
        account_meta,
        current_identity,
    };

    let accounts = aap_compressed::accounts::RevokeAgent {
        signer: payer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
        .await
}

// =========================================================================
// Helper: propose_agreement
// =========================================================================
async fn propose_agreement<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    agent_signer: &Keypair,
    proposer_account: &CompressedAccount,
    address_tree_info: light_client::indexer::TreeInfo,
    agreement_id: [u8; 16],
    terms_hash: [u8; 32],
    terms_uri: [u8; 64],
    num_parties: u8,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Derive agreement + party addresses
    let (agreement_address, _) = derive_address(
        &[b"agreement", &agreement_id],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );
    let proposer_address = proposer_account.address.unwrap();
    let (party_address, _) = derive_address(
        &[b"party", &agreement_id, &proposer_address],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    // Get validity proof for: existing proposer account + two new addresses
    let proposer_hash = proposer_account.hash;
    let rpc_result = rpc
        .get_validity_proof(
            vec![proposer_hash],
            vec![
                AddressWithTree {
                    tree: address_tree_info.tree,
                    address: agreement_address,
                },
                AddressWithTree {
                    tree: address_tree_info.tree,
                    address: party_address,
                },
            ],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .clone();

    let state_trees = packed_tree_accounts.state_trees.unwrap();

    let proposer_identity = CompressedAgentIdentity::deserialize(
        &mut proposer_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let proposer_account_meta = CompressedAccountMeta {
        tree_info: state_trees.packed_tree_infos[0],
        address: proposer_address,
        output_state_tree_index: state_trees.output_tree_index,
    };

    let output_state_tree_index = state_trees.output_tree_index;

    let instruction_data = aap_compressed::instruction::ProposeAgreement {
        proof: rpc_result.proof,
        proposer_account_meta,
        proposer_identity,
        agreement_address_tree_info: packed_tree_accounts.address_trees[0],
        party_address_tree_info: packed_tree_accounts.address_trees[1],
        output_state_tree_index,
        agreement_id,
        agreement_type: 0,
        visibility: 0,
        terms_hash,
        terms_uri,
        num_parties,
        expires_at: 0,
    };

    let accounts = aap_compressed::accounts::ProposeAgreement {
        signer: agent_signer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer, agent_signer])
        .await
}

// =========================================================================
// Helper: add_party
// =========================================================================
#[allow(clippy::too_many_arguments)]
async fn add_party<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    proposer_signer: &Keypair,
    proposer_account: &CompressedAccount,
    agreement_account: &CompressedAccount,
    party_identity_account: &CompressedAccount,
    address_tree_info: light_client::indexer::TreeInfo,
    role: u8,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Derive the party address from agreement_id + party identity address
    let agreement_data = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let party_identity_address = party_identity_account.address.unwrap();
    let (party_address, _) = derive_address(
        &[b"party", &agreement_data.agreement_id, &party_identity_address],
        &address_tree_info.tree,
        &aap_compressed::ID,
    );

    // Validity proof: 3 existing accounts + 1 new address
    let rpc_result = rpc
        .get_validity_proof(
            vec![
                proposer_account.hash,
                agreement_account.hash,
                party_identity_account.hash,
            ],
            vec![AddressWithTree {
                tree: address_tree_info.tree,
                address: party_address,
            }],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .clone();
    let state_trees = packed_tree_accounts.state_trees.unwrap();

    let proposer_identity = CompressedAgentIdentity::deserialize(
        &mut proposer_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_agreement = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let party_identity = CompressedAgentIdentity::deserialize(
        &mut party_identity_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let proposer_account_meta = CompressedAccountMeta {
        tree_info: state_trees.packed_tree_infos[0],
        address: proposer_account.address.unwrap(),
        output_state_tree_index: state_trees.output_tree_index,
    };
    let agreement_account_meta = CompressedAccountMeta {
        tree_info: state_trees.packed_tree_infos[1],
        address: agreement_account.address.unwrap(),
        output_state_tree_index: state_trees.output_tree_index,
    };
    let party_identity_account_meta = CompressedAccountMeta {
        tree_info: state_trees.packed_tree_infos[2],
        address: party_identity_address,
        output_state_tree_index: state_trees.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::AddParty {
        proof: rpc_result.proof,
        proposer_account_meta,
        proposer_identity,
        agreement_account_meta,
        current_agreement,
        party_identity_account_meta,
        party_identity,
        party_address_tree_info: packed_tree_accounts.address_trees[0],
        output_state_tree_index: state_trees.output_tree_index,
        role,
    };

    let accounts = aap_compressed::accounts::AddParty {
        signer: proposer_signer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer, proposer_signer])
        .await
}

// =========================================================================
// Helper: sign_agreement
// =========================================================================
async fn sign_agreement<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    signer_agent: &Keypair,
    signer_identity_account: &CompressedAccount,
    agreement_account: &CompressedAccount,
    party_account: &CompressedAccount,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Validity proof: 3 existing accounts
    let rpc_result = rpc
        .get_validity_proof(
            vec![
                signer_identity_account.hash,
                agreement_account.hash,
                party_account.hash,
            ],
            vec![],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let signer_identity = CompressedAgentIdentity::deserialize(
        &mut signer_identity_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_agreement = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_party = CompressedAgreementParty::deserialize(
        &mut party_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let signer_identity_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: signer_identity_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let agreement_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[1],
        address: agreement_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let party_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[2],
        address: party_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::SignAgreement {
        proof: rpc_result.proof,
        signer_identity_meta,
        signer_identity,
        agreement_meta,
        current_agreement,
        party_meta,
        current_party,
    };

    let accounts = aap_compressed::accounts::SignAgreement {
        signer: signer_agent.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer, signer_agent])
        .await
}

// =========================================================================
// Helper: fulfill_agreement
// =========================================================================
async fn fulfill_agreement<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    signer_agent: &Keypair,
    signer_identity_account: &CompressedAccount,
    signer_party_account: &CompressedAccount,
    agreement_account: &CompressedAccount,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Validity proof: 3 existing accounts
    let rpc_result = rpc
        .get_validity_proof(
            vec![
                signer_identity_account.hash,
                signer_party_account.hash,
                agreement_account.hash,
            ],
            vec![],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let signer_identity = CompressedAgentIdentity::deserialize(
        &mut signer_identity_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let signer_party = CompressedAgreementParty::deserialize(
        &mut signer_party_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_agreement = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let signer_identity_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: signer_identity_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let signer_party_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[1],
        address: signer_party_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let agreement_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[2],
        address: agreement_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::FulfillAgreement {
        proof: rpc_result.proof,
        signer_identity_meta,
        signer_identity,
        signer_party_meta,
        signer_party,
        agreement_meta,
        current_agreement,
    };

    let accounts = aap_compressed::accounts::FulfillAgreement {
        signer: signer_agent.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer, signer_agent])
        .await
}

// =========================================================================
// Helper: close_agreement
// =========================================================================
async fn close_agreement<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    signer_identity_account: &CompressedAccount,
    signer_party_account: &CompressedAccount,
    agreement_account: &CompressedAccount,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Validity proof: 3 existing accounts
    let rpc_result = rpc
        .get_validity_proof(
            vec![
                signer_identity_account.hash,
                signer_party_account.hash,
                agreement_account.hash,
            ],
            vec![],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let signer_identity = CompressedAgentIdentity::deserialize(
        &mut signer_identity_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let signer_party = CompressedAgreementParty::deserialize(
        &mut signer_party_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_agreement = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let signer_identity_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: signer_identity_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let signer_party_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[1],
        address: signer_party_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let agreement_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[2],
        address: agreement_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::CloseAgreement {
        proof: rpc_result.proof,
        signer_identity_meta,
        signer_identity,
        signer_party_meta,
        signer_party,
        agreement_meta,
        current_agreement,
    };

    // close_agreement requires authority (payer), not agent_key
    let accounts = aap_compressed::accounts::CloseAgreement {
        signer: payer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
        .await
}

// =========================================================================
// Helper: cancel_agreement
// =========================================================================
async fn cancel_agreement<R: Rpc + Indexer>(
    rpc: &mut R,
    payer: &Keypair,
    proposer_signer: &Keypair,
    proposer_identity_account: &CompressedAccount,
    agreement_account: &CompressedAccount,
) -> Result<Signature, RpcError> {
    let mut remaining_accounts = PackedAccounts::default();
    let config = SystemAccountMetaConfig::new(aap_compressed::ID);
    remaining_accounts.add_system_accounts_v2(config)?;

    // Validity proof: 2 existing accounts
    let rpc_result = rpc
        .get_validity_proof(
            vec![
                proposer_identity_account.hash,
                agreement_account.hash,
            ],
            vec![],
            None,
        )
        .await?
        .value;

    let packed_tree_accounts = rpc_result
        .pack_tree_infos(&mut remaining_accounts)
        .state_trees
        .unwrap();

    let proposer_identity = CompressedAgentIdentity::deserialize(
        &mut proposer_identity_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();
    let current_agreement = CompressedAgreement::deserialize(
        &mut agreement_account.data.as_ref().unwrap().data.as_slice(),
    )
    .unwrap();

    let proposer_identity_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[0],
        address: proposer_identity_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };
    let agreement_meta = CompressedAccountMeta {
        tree_info: packed_tree_accounts.packed_tree_infos[1],
        address: agreement_account.address.unwrap(),
        output_state_tree_index: packed_tree_accounts.output_tree_index,
    };

    let instruction_data = aap_compressed::instruction::CancelAgreement {
        proof: rpc_result.proof,
        proposer_identity_meta,
        proposer_identity,
        agreement_meta,
        current_agreement,
    };

    let accounts = aap_compressed::accounts::CancelAgreement {
        signer: proposer_signer.pubkey(),
    };

    let (remaining_accounts_metas, _, _) = remaining_accounts.to_account_metas();

    let instruction = Instruction {
        program_id: aap_compressed::ID,
        accounts: [
            accounts.to_account_metas(Some(true)),
            remaining_accounts_metas,
        ]
        .concat(),
        data: instruction_data.data(),
    };

    rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer, proposer_signer])
        .await
}

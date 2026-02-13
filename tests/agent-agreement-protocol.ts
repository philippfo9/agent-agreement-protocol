import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentAgreementProtocol } from "../target/types/agent_agreement_protocol";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";

// Constants matching on-chain
const AGREEMENT_TYPE_SERVICE = 1;
const STATUS_PROPOSED = 0;
const STATUS_ACTIVE = 1;
const STATUS_FULFILLED = 2;
const STATUS_CANCELLED = 5;
const VISIBILITY_PUBLIC = 0;
const VISIBILITY_PRIVATE = 1;
const ROLE_PROPOSER = 0;
const ROLE_COUNTERPARTY = 1;

function generateAgreementId(): number[] {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}

function makeTermsHash(): number[] {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
}

function makeTermsUri(): number[] {
  const uri = "ar://test-terms-document-hash-placeholder";
  const bytes = Array.from(Buffer.from(uri));
  while (bytes.length < 64) bytes.push(0);
  return bytes;
}

function makeMetadataHash(): number[] {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
}

function findAgentIdentityPda(
  agentKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentKey.toBuffer()],
    programId
  );
}

function findAgreementPda(
  agreementId: number[],
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agreement"), Buffer.from(agreementId)],
    programId
  );
}

function findPartyPda(
  agreementId: number[],
  identityPda: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("party"),
      Buffer.from(agreementId),
      identityPda.toBuffer(),
    ],
    programId
  );
}

describe("Agent Agreement Protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .agentAgreementProtocol as Program<AgentAgreementProtocol>;

  // Shared keypairs
  let authorityA: Keypair;
  let agentKeyA: Keypair;
  let authorityB: Keypair;
  let agentKeyB: Keypair;

  // PDAs
  let identityPdaA: PublicKey;
  let identityPdaB: PublicKey;

  before(async () => {
    authorityA = Keypair.generate();
    agentKeyA = Keypair.generate();
    authorityB = Keypair.generate();
    agentKeyB = Keypair.generate();

    // Airdrop SOL to authorities and agent keys
    const airdrops = [authorityA, agentKeyA, authorityB, agentKeyB].map(
      async (kp) => {
        const sig = await provider.connection.requestAirdrop(
          kp.publicKey,
          10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");
      }
    );
    await Promise.all(airdrops);

    [identityPdaA] = findAgentIdentityPda(
      agentKeyA.publicKey,
      program.programId
    );
    [identityPdaB] = findAgentIdentityPda(
      agentKeyB.publicKey,
      program.programId
    );
  });

  // ============================================================
  // Module 1: Agent Registry
  // ============================================================

  describe("register_agent", () => {
    it("registers an agent with valid scope", async () => {
      await program.methods
        .registerAgent(agentKeyA.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: true,
          maxCommitLamports: new BN(1_000_000_000),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authorityA.publicKey,
          agentIdentity: identityPdaA,
          systemProgram: SystemProgram.programId,
        })
        .signers([authorityA])
        .rpc();

      const identity = await program.account.agentIdentity.fetch(identityPdaA);
      expect(identity.authority.toBase58()).to.equal(
        authorityA.publicKey.toBase58()
      );
      expect(identity.agentKey.toBase58()).to.equal(
        agentKeyA.publicKey.toBase58()
      );
      expect(identity.scope.canSignAgreements).to.be.true;
      expect(identity.scope.canCommitFunds).to.be.true;
      expect(identity.parent.toBase58()).to.equal(PublicKey.default.toBase58());
    });

    it("registers agent B", async () => {
      await program.methods
        .registerAgent(agentKeyB.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authorityB.publicKey,
          agentIdentity: identityPdaB,
          systemProgram: SystemProgram.programId,
        })
        .signers([authorityB])
        .rpc();

      const identity = await program.account.agentIdentity.fetch(identityPdaB);
      expect(identity.authority.toBase58()).to.equal(
        authorityB.publicKey.toBase58()
      );
    });

    it("allows agent_key == authority (human wallet signing)", async () => {
      const humanWallet = Keypair.generate();
      const [humanPda] = findAgentIdentityPda(
        humanWallet.publicKey,
        program.programId
      );

      // Airdrop some SOL
      const sig = await provider.connection.requestAirdrop(humanWallet.publicKey, 1_000_000_000);
      await provider.connection.confirmTransaction(sig, "confirmed");

      await program.methods
        .registerAgent(humanWallet.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: humanWallet.publicKey,
          agentIdentity: humanPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([humanWallet])
        .rpc();

      const account = await program.account.agentIdentity.fetch(humanPda);
      expect(account.agentKey.toBase58()).to.equal(humanWallet.publicKey.toBase58());
      expect(account.authority.toBase58()).to.equal(humanWallet.publicKey.toBase58());
    });

    it("fails with already expired scope", async () => {
      const tempAgent = Keypair.generate();
      const [tempPda] = findAgentIdentityPda(
        tempAgent.publicKey,
        program.programId
      );
      try {
        await program.methods
          .registerAgent(tempAgent.publicKey, makeMetadataHash(), {
            canSignAgreements: true,
            canCommitFunds: false,
            maxCommitLamports: new BN(0),
            expiresAt: new BN(1), // epoch 1 is in the past
          })
          .accounts({
            authority: authorityA.publicKey,
            agentIdentity: tempPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([authorityA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ScopeExpired");
      }
    });
  });

  describe("update_delegation", () => {
    it("authority updates agent scope", async () => {
      await program.methods
        .updateDelegation({
          canSignAgreements: true,
          canCommitFunds: true,
          maxCommitLamports: new BN(5_000_000_000),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authorityA.publicKey,
          agentIdentity: identityPdaA,
        })
        .signers([authorityA])
        .rpc();

      const identity = await program.account.agentIdentity.fetch(identityPdaA);
      expect(identity.scope.maxCommitLamports.toNumber()).to.equal(
        5_000_000_000
      );
    });

    it("fails when non-authority tries to update", async () => {
      try {
        await program.methods
          .updateDelegation({
            canSignAgreements: false,
            canCommitFunds: false,
            maxCommitLamports: new BN(0),
            expiresAt: new BN(0),
          })
          .accounts({
            authority: authorityB.publicKey,
            agentIdentity: identityPdaA,
          })
          .signers([authorityB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  describe("register_sub_agent", () => {
    let subAgentKey: Keypair;
    let subAgentPda: PublicKey;

    before(() => {
      subAgentKey = Keypair.generate();
      [subAgentPda] = findAgentIdentityPda(
        subAgentKey.publicKey,
        program.programId
      );
    });

    it("agent registers a sub-agent", async () => {
      await program.methods
        .registerSubAgent(subAgentKey.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: true,
          maxCommitLamports: new BN(500_000_000),
          expiresAt: new BN(0),
        })
        .accounts({
          parentAgentSigner: agentKeyA.publicKey,
          parentIdentity: identityPdaA,
          subAgentIdentity: subAgentPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      const subIdentity =
        await program.account.agentIdentity.fetch(subAgentPda);
      expect(subIdentity.parent.toBase58()).to.equal(
        identityPdaA.toBase58()
      );
      expect(subIdentity.authority.toBase58()).to.equal(
        authorityA.publicKey.toBase58()
      );
      expect(subIdentity.scope.maxCommitLamports.toNumber()).to.equal(
        500_000_000
      );
    });

    it("fails when sub-agent tries to register sub-sub-agent (max depth)", async () => {
      // Fund the sub-agent key so it can pay for tx
      const sig = await provider.connection.requestAirdrop(
        subAgentKey.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");

      const subSubKey = Keypair.generate();
      const [subSubPda] = findAgentIdentityPda(
        subSubKey.publicKey,
        program.programId
      );
      try {
        await program.methods
          .registerSubAgent(subSubKey.publicKey, makeMetadataHash(), {
            canSignAgreements: true,
            canCommitFunds: false,
            maxCommitLamports: new BN(0),
            expiresAt: new BN(0),
          })
          .accounts({
            parentAgentSigner: subAgentKey.publicKey,
            parentIdentity: subAgentPda,
            subAgentIdentity: subSubPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([subAgentKey])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Error could be a custom error or an Anchor constraint error
        const errorCode = err?.error?.errorCode?.code;
        expect(errorCode).to.equal("MaxDelegationDepth");
      }
    });

    it("fails when sub-agent scope exceeds parent max_commit_lamports", async () => {
      const badSubKey = Keypair.generate();
      const [badSubPda] = findAgentIdentityPda(
        badSubKey.publicKey,
        program.programId
      );
      try {
        await program.methods
          .registerSubAgent(badSubKey.publicKey, makeMetadataHash(), {
            canSignAgreements: true,
            canCommitFunds: true,
            maxCommitLamports: new BN(999_999_999_999), // exceeds parent 5B
            expiresAt: new BN(0),
          })
          .accounts({
            parentAgentSigner: agentKeyA.publicKey,
            parentIdentity: identityPdaA,
            subAgentIdentity: badSubPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([agentKeyA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal(
          "SubAgentScopeExceedsParent"
        );
      }
    });
  });

  describe("revoke_agent", () => {
    let tempAgentKey: Keypair;
    let tempIdentityPda: PublicKey;

    before(async () => {
      tempAgentKey = Keypair.generate();
      [tempIdentityPda] = findAgentIdentityPda(
        tempAgentKey.publicKey,
        program.programId
      );

      // Register a temp agent to revoke
      await program.methods
        .registerAgent(tempAgentKey.publicKey, makeMetadataHash(), {
          canSignAgreements: false,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authorityA.publicKey,
          agentIdentity: tempIdentityPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authorityA])
        .rpc();
    });

    it("authority revokes agent — PDA closed, rent returned", async () => {
      const balBefore = await provider.connection.getBalance(
        authorityA.publicKey
      );

      await program.methods
        .revokeAgent()
        .accounts({
          authority: authorityA.publicKey,
          agentIdentity: tempIdentityPda,
        })
        .signers([authorityA])
        .rpc();

      const balAfter = await provider.connection.getBalance(
        authorityA.publicKey
      );
      // Balance should increase (rent reclaimed, minus tx fee)
      expect(balAfter).to.be.greaterThan(balBefore - 10000);

      // Account should be closed
      const info = await provider.connection.getAccountInfo(tempIdentityPda);
      expect(info).to.be.null;
    });

    it("fails when non-authority tries to revoke", async () => {
      try {
        await program.methods
          .revokeAgent()
          .accounts({
            authority: authorityB.publicKey,
            agentIdentity: identityPdaA,
          })
          .signers([authorityB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ============================================================
  // Module 2: Agreement Engine
  // ============================================================

  describe("propose_agreement", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;

    before(() => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );
    });

    it("agent proposes a public agreement", async () => {
      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2, // num_parties
          new BN(0) // no expiry
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      const agreement = await program.account.agreement.fetch(agreementPda);
      expect(agreement.status).to.equal(STATUS_PROPOSED);
      expect(agreement.numParties).to.equal(2);
      expect(agreement.numSigned).to.equal(1); // proposer auto-signs
      expect(agreement.partiesAdded).to.equal(1);
      expect(agreement.proposer.toBase58()).to.equal(
        identityPdaA.toBase58()
      );

      const party =
        await program.account.agreementParty.fetch(proposerPartyPda);
      expect(party.signed).to.be.true;
      expect(party.role).to.equal(ROLE_PROPOSER);
    });

    it("fails with invalid agreement type", async () => {
      const badId = generateAgreementId();
      const [badPda] = findAgreementPda(badId, program.programId);
      const [badPartyPda] = findPartyPda(
        badId,
        identityPdaA,
        program.programId
      );
      try {
        await program.methods
          .proposeAgreement(
            badId,
            99, // invalid type
            VISIBILITY_PUBLIC,
            makeTermsHash(),
            makeTermsUri(),
            2,
            new BN(0)
          )
          .accounts({
            proposerSigner: agentKeyA.publicKey,
            proposerIdentity: identityPdaA,
            agreement: badPda,
            proposerParty: badPartyPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([agentKeyA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidAgreementType");
      }
    });

    it("fails with invalid num_parties (< 2)", async () => {
      const badId = generateAgreementId();
      const [badPda] = findAgreementPda(badId, program.programId);
      const [badPartyPda] = findPartyPda(
        badId,
        identityPdaA,
        program.programId
      );
      try {
        await program.methods
          .proposeAgreement(
            badId,
            AGREEMENT_TYPE_SERVICE,
            VISIBILITY_PUBLIC,
            makeTermsHash(),
            makeTermsUri(),
            1, // too few
            new BN(0)
          )
          .accounts({
            proposerSigner: agentKeyA.publicKey,
            proposerIdentity: identityPdaA,
            agreement: badPda,
            proposerParty: badPartyPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([agentKeyA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidPartyCount");
      }
    });
  });

  describe("add_party", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;
    let counterpartyPda: PublicKey;

    before(async () => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );
      [counterpartyPda] = findPartyPda(
        agreementId,
        identityPdaB,
        program.programId
      );

      // Create agreement
      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();
    });

    it("proposer adds counterparty", async () => {
      await program.methods
        .addParty(agreementId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          partyIdentity: identityPdaB,
          party: counterpartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      const party =
        await program.account.agreementParty.fetch(counterpartyPda);
      expect(party.role).to.equal(ROLE_COUNTERPARTY);
      expect(party.signed).to.be.false;

      const agreement = await program.account.agreement.fetch(agreementPda);
      expect(agreement.partiesAdded).to.equal(2);
    });

    it("fails when non-proposer tries to add party", async () => {
      const extraId = generateAgreementId();
      const [extraPda] = findAgreementPda(extraId, program.programId);
      const [extraProposerPda] = findPartyPda(
        extraId,
        identityPdaA,
        program.programId
      );

      // Create a fresh agreement first
      await program.methods
        .proposeAgreement(
          extraId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: extraPda,
          proposerParty: extraProposerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      const [extraCounterpartyPda] = findPartyPda(
        extraId,
        identityPdaB,
        program.programId
      );

      try {
        await program.methods
          .addParty(extraId, ROLE_COUNTERPARTY)
          .accounts({
            proposerSigner: agentKeyB.publicKey,
            proposerIdentity: identityPdaB,
            agreement: extraPda,
            partyIdentity: identityPdaB,
            party: extraCounterpartyPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([agentKeyB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  describe("sign_agreement", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;
    let counterpartyPda: PublicKey;

    before(async () => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );
      [counterpartyPda] = findPartyPda(
        agreementId,
        identityPdaB,
        program.programId
      );

      // Create and add party
      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .addParty(agreementId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          partyIdentity: identityPdaB,
          party: counterpartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();
    });

    it("counterparty signs → agreement becomes Active", async () => {
      await program.methods
        .signAgreement(agreementId)
        .accounts({
          signer: agentKeyB.publicKey,
          signerIdentity: identityPdaB,
          agreement: agreementPda,
          party: counterpartyPda,
        })
        .signers([agentKeyB])
        .rpc();

      const party =
        await program.account.agreementParty.fetch(counterpartyPda);
      expect(party.signed).to.be.true;
      expect(party.signedAt.toNumber()).to.be.greaterThan(0);

      const agreement = await program.account.agreement.fetch(agreementPda);
      expect(agreement.numSigned).to.equal(2);
      expect(agreement.status).to.equal(STATUS_ACTIVE);
    });

    it("fails when already signed", async () => {
      try {
        await program.methods
          .signAgreement(agreementId)
          .accounts({
            signer: agentKeyB.publicKey,
            signerIdentity: identityPdaB,
            agreement: agreementPda,
            party: counterpartyPda,
          })
          .signers([agentKeyB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Could be AlreadySigned or InvalidStatus (since agreement is now Active)
        expect(["AlreadySigned", "InvalidStatus"]).to.include(
          err.error.errorCode.code
        );
      }
    });
  });

  describe("cancel_agreement", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;

    before(async () => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );

      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();
    });

    it("proposer cancels agreement", async () => {
      await program.methods
        .cancelAgreement(agreementId)
        .accounts({
          signer: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
        })
        .signers([agentKeyA])
        .rpc();

      const agreement = await program.account.agreement.fetch(agreementPda);
      expect(agreement.status).to.equal(STATUS_CANCELLED);
    });

    it("proposer's authority can also cancel", async () => {
      const newId = generateAgreementId();
      const [newPda] = findAgreementPda(newId, program.programId);
      const [newPartyPda] = findPartyPda(
        newId,
        identityPdaA,
        program.programId
      );

      await program.methods
        .proposeAgreement(
          newId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: newPda,
          proposerParty: newPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .cancelAgreement(newId)
        .accounts({
          signer: authorityA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: newPda,
        })
        .signers([authorityA])
        .rpc();

      const agreement = await program.account.agreement.fetch(newPda);
      expect(agreement.status).to.equal(STATUS_CANCELLED);
    });

    it("fails when non-proposer tries to cancel", async () => {
      const newId = generateAgreementId();
      const [newPda] = findAgreementPda(newId, program.programId);
      const [newPartyPda] = findPartyPda(
        newId,
        identityPdaA,
        program.programId
      );

      await program.methods
        .proposeAgreement(
          newId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: newPda,
          proposerParty: newPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      try {
        await program.methods
          .cancelAgreement(newId)
          .accounts({
            signer: agentKeyB.publicKey,
            proposerIdentity: identityPdaB,
            agreement: newPda,
          })
          .signers([agentKeyB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  describe("fulfill_agreement", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;
    let counterpartyPda: PublicKey;

    before(async () => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );
      [counterpartyPda] = findPartyPda(
        agreementId,
        identityPdaB,
        program.programId
      );

      // Full flow: propose -> add party -> sign -> Active
      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .addParty(agreementId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          partyIdentity: identityPdaB,
          party: counterpartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .signAgreement(agreementId)
        .accounts({
          signer: agentKeyB.publicKey,
          signerIdentity: identityPdaB,
          agreement: agreementPda,
          party: counterpartyPda,
        })
        .signers([agentKeyB])
        .rpc();
    });

    it("party fulfills Active agreement", async () => {
      await program.methods
        .fulfillAgreement(agreementId)
        .accounts({
          signer: agentKeyA.publicKey,
          signerIdentity: identityPdaA,
          signerParty: proposerPartyPda,
          agreement: agreementPda,
        })
        .signers([agentKeyA])
        .rpc();

      const agreement = await program.account.agreement.fetch(agreementPda);
      expect(agreement.status).to.equal(STATUS_FULFILLED);
    });

    it("fails to fulfill non-Active agreement", async () => {
      try {
        await program.methods
          .fulfillAgreement(agreementId)
          .accounts({
            signer: agentKeyA.publicKey,
            signerIdentity: identityPdaA,
            signerParty: proposerPartyPda,
            agreement: agreementPda,
          })
          .signers([agentKeyA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidStatus");
      }
    });
  });

  describe("close_agreement", () => {
    let agreementId: number[];
    let agreementPda: PublicKey;
    let proposerPartyPda: PublicKey;
    let counterpartyPda: PublicKey;

    before(async () => {
      agreementId = generateAgreementId();
      [agreementPda] = findAgreementPda(agreementId, program.programId);
      [proposerPartyPda] = findPartyPda(
        agreementId,
        identityPdaA,
        program.programId
      );
      [counterpartyPda] = findPartyPda(
        agreementId,
        identityPdaB,
        program.programId
      );

      // Full flow to fulfilled
      await program.methods
        .proposeAgreement(
          agreementId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .addParty(agreementId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: agentKeyA.publicKey,
          proposerIdentity: identityPdaA,
          agreement: agreementPda,
          partyIdentity: identityPdaB,
          party: counterpartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      await program.methods
        .signAgreement(agreementId)
        .accounts({
          signer: agentKeyB.publicKey,
          signerIdentity: identityPdaB,
          agreement: agreementPda,
          party: counterpartyPda,
        })
        .signers([agentKeyB])
        .rpc();

      await program.methods
        .fulfillAgreement(agreementId)
        .accounts({
          signer: agentKeyA.publicKey,
          signerIdentity: identityPdaA,
          signerParty: proposerPartyPda,
          agreement: agreementPda,
        })
        .signers([agentKeyA])
        .rpc();
    });

    it("authority closes fulfilled agreement — PDAs closed, rent reclaimed", async () => {
      const balBefore = await provider.connection.getBalance(
        authorityA.publicKey
      );

      await program.methods
        .closeAgreement(agreementId)
        .accounts({
          signer: authorityA.publicKey,
          signerIdentity: identityPdaA,
          signerParty: proposerPartyPda,
          agreement: agreementPda,
        })
        .signers([authorityA])
        .rpc();

      const balAfter = await provider.connection.getBalance(
        authorityA.publicKey
      );
      expect(balAfter).to.be.greaterThan(balBefore - 10000);

      // Both PDAs should be closed
      const agreementInfo =
        await provider.connection.getAccountInfo(agreementPda);
      expect(agreementInfo).to.be.null;

      const partyInfo =
        await provider.connection.getAccountInfo(proposerPartyPda);
      expect(partyInfo).to.be.null;
    });
  });

  // ============================================================
  // Integration Tests: Full Flows
  // ============================================================

  describe("Integration: Full happy-path flow", () => {
    it("register → propose → add party → sign → fulfill → close", async () => {
      const authX = Keypair.generate();
      const agentX = Keypair.generate();
      const authY = Keypair.generate();
      const agentY = Keypair.generate();

      for (const kp of [authX, agentX, authY, agentY]) {
        const sig = await provider.connection.requestAirdrop(
          kp.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");
      }

      const [idPdaX] = findAgentIdentityPda(
        agentX.publicKey,
        program.programId
      );
      const [idPdaY] = findAgentIdentityPda(
        agentY.publicKey,
        program.programId
      );

      // 1. Register
      await program.methods
        .registerAgent(agentX.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authX.publicKey,
          agentIdentity: idPdaX,
          systemProgram: SystemProgram.programId,
        })
        .signers([authX])
        .rpc();

      await program.methods
        .registerAgent(agentY.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authY.publicKey,
          agentIdentity: idPdaY,
          systemProgram: SystemProgram.programId,
        })
        .signers([authY])
        .rpc();

      // 2. Propose
      const agId = generateAgreementId();
      const [agPda] = findAgreementPda(agId, program.programId);
      const [partyXPda] = findPartyPda(agId, idPdaX, program.programId);
      const [partyYPda] = findPartyPda(agId, idPdaY, program.programId);

      await program.methods
        .proposeAgreement(
          agId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentX.publicKey,
          proposerIdentity: idPdaX,
          agreement: agPda,
          proposerParty: partyXPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentX])
        .rpc();

      // 3. Add party
      await program.methods
        .addParty(agId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: agentX.publicKey,
          proposerIdentity: idPdaX,
          agreement: agPda,
          partyIdentity: idPdaY,
          party: partyYPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentX])
        .rpc();

      // 4. Sign
      await program.methods
        .signAgreement(agId)
        .accounts({
          signer: agentY.publicKey,
          signerIdentity: idPdaY,
          agreement: agPda,
          party: partyYPda,
        })
        .signers([agentY])
        .rpc();

      let agreement = await program.account.agreement.fetch(agPda);
      expect(agreement.status).to.equal(STATUS_ACTIVE);

      // 5. Fulfill
      await program.methods
        .fulfillAgreement(agId)
        .accounts({
          signer: agentX.publicKey,
          signerIdentity: idPdaX,
          signerParty: partyXPda,
          agreement: agPda,
        })
        .signers([agentX])
        .rpc();

      agreement = await program.account.agreement.fetch(agPda);
      expect(agreement.status).to.equal(STATUS_FULFILLED);

      // 6. Close
      const balBefore = await provider.connection.getBalance(authX.publicKey);

      await program.methods
        .closeAgreement(agId)
        .accounts({
          signer: authX.publicKey,
          signerIdentity: idPdaX,
          signerParty: partyXPda,
          agreement: agPda,
        })
        .signers([authX])
        .rpc();

      const balAfter = await provider.connection.getBalance(authX.publicKey);
      expect(balAfter).to.be.greaterThan(balBefore - 10000);

      const agInfo = await provider.connection.getAccountInfo(agPda);
      expect(agInfo).to.be.null;
    });
  });

  describe("Integration: Cancel flow", () => {
    it("propose → cancel → close → rent reclaimed", async () => {
      const authC = Keypair.generate();
      const agentC = Keypair.generate();

      for (const kp of [authC, agentC]) {
        const sig = await provider.connection.requestAirdrop(
          kp.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");
      }

      const [idPdaC] = findAgentIdentityPda(
        agentC.publicKey,
        program.programId
      );

      await program.methods
        .registerAgent(agentC.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: authC.publicKey,
          agentIdentity: idPdaC,
          systemProgram: SystemProgram.programId,
        })
        .signers([authC])
        .rpc();

      const agId = generateAgreementId();
      const [agPda] = findAgreementPda(agId, program.programId);
      const [partyCPda] = findPartyPda(agId, idPdaC, program.programId);

      await program.methods
        .proposeAgreement(
          agId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PRIVATE,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: agentC.publicKey,
          proposerIdentity: idPdaC,
          agreement: agPda,
          proposerParty: partyCPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentC])
        .rpc();

      // Cancel
      await program.methods
        .cancelAgreement(agId)
        .accounts({
          signer: agentC.publicKey,
          proposerIdentity: idPdaC,
          agreement: agPda,
        })
        .signers([agentC])
        .rpc();

      const agreement = await program.account.agreement.fetch(agPda);
      expect(agreement.status).to.equal(STATUS_CANCELLED);
      expect(agreement.visibility).to.equal(VISIBILITY_PRIVATE);

      // Close
      await program.methods
        .closeAgreement(agId)
        .accounts({
          signer: authC.publicKey,
          signerIdentity: idPdaC,
          signerParty: partyCPda,
          agreement: agPda,
        })
        .signers([authC])
        .rpc();

      const agInfo = await provider.connection.getAccountInfo(agPda);
      expect(agInfo).to.be.null;
    });
  });

  describe("Integration: Sub-agent signing flow", () => {
    it("agent registers sub-agent → sub-agent proposes → counterparty signs → Active", async () => {
      const subKey = Keypair.generate();
      const [subPda] = findAgentIdentityPda(
        subKey.publicKey,
        program.programId
      );

      const sig = await provider.connection.requestAirdrop(
        subKey.publicKey,
        5 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");

      // Register sub-agent under agent A
      await program.methods
        .registerSubAgent(subKey.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          parentAgentSigner: agentKeyA.publicKey,
          parentIdentity: identityPdaA,
          subAgentIdentity: subPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeyA])
        .rpc();

      // Sub-agent proposes
      const agId = generateAgreementId();
      const [agPda] = findAgreementPda(agId, program.programId);
      const [subPartyPda] = findPartyPda(agId, subPda, program.programId);
      const [bPartyPda] = findPartyPda(agId, identityPdaB, program.programId);

      await program.methods
        .proposeAgreement(
          agId,
          AGREEMENT_TYPE_SERVICE,
          VISIBILITY_PUBLIC,
          makeTermsHash(),
          makeTermsUri(),
          2,
          new BN(0)
        )
        .accounts({
          proposerSigner: subKey.publicKey,
          proposerIdentity: subPda,
          agreement: agPda,
          proposerParty: subPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([subKey])
        .rpc();

      // Add counterparty
      await program.methods
        .addParty(agId, ROLE_COUNTERPARTY)
        .accounts({
          proposerSigner: subKey.publicKey,
          proposerIdentity: subPda,
          agreement: agPda,
          partyIdentity: identityPdaB,
          party: bPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([subKey])
        .rpc();

      // Counterparty signs
      await program.methods
        .signAgreement(agId)
        .accounts({
          signer: agentKeyB.publicKey,
          signerIdentity: identityPdaB,
          agreement: agPda,
          party: bPartyPda,
        })
        .signers([agentKeyB])
        .rpc();

      const agreement = await program.account.agreement.fetch(agPda);
      expect(agreement.status).to.equal(STATUS_ACTIVE);

      const subIdentity = await program.account.agentIdentity.fetch(subPda);
      expect(subIdentity.parent.toBase58()).to.equal(identityPdaA.toBase58());
    });
  });

  describe("Integration: Human-to-human direct signing flow", () => {
    it("register → propose → addPartyDirect → signAgreementDirect → Active", async () => {
      // Human A registers with wallet as agent_key
      const humanA = Keypair.generate();
      const humanB = Keypair.generate();

      const sigA = await provider.connection.requestAirdrop(humanA.publicKey, 2_000_000_000);
      await provider.connection.confirmTransaction(sigA, "confirmed");

      const [humanAPda] = findAgentIdentityPda(humanA.publicKey, program.programId);

      await program.methods
        .registerAgent(humanA.publicKey, makeMetadataHash(), {
          canSignAgreements: true,
          canCommitFunds: false,
          maxCommitLamports: new BN(0),
          expiresAt: new BN(0),
        })
        .accounts({
          authority: humanA.publicKey,
          agentIdentity: humanAPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([humanA])
        .rpc();

      // Human A proposes agreement
      const agreementId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
      const [agPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agreement"), Buffer.from(agreementId)],
        program.programId
      );
      const [proposerPartyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("party"), Buffer.from(agreementId), humanAPda.toBuffer()],
        program.programId
      );

      await program.methods
        .proposeAgreement(
          agreementId, 1, 0,
          new Array(32).fill(0),
          new Array(64).fill(0),
          2,
          new BN(Math.floor(Date.now() / 1000) + 86400)
        )
        .accounts({
          proposerSigner: humanA.publicKey,
          proposerIdentity: humanAPda,
          agreement: agPda,
          proposerParty: proposerPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([humanA])
        .rpc();

      // Add Human B as counterparty (direct — no registration)
      const [counterpartyPartyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("party"), Buffer.from(agreementId), humanB.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .addPartyDirect(agreementId, humanB.publicKey, 1)
        .accounts({
          proposerSigner: humanA.publicKey,
          proposerIdentity: humanAPda,
          agreement: agPda,
          party: counterpartyPartyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([humanA])
        .rpc();

      // Verify party added
      const party = await program.account.agreementParty.fetch(counterpartyPartyPda);
      expect(party.agentIdentity.toBase58()).to.equal(humanB.publicKey.toBase58());
      expect(party.signed).to.be.false;

      // Human B signs directly
      const sigB = await provider.connection.requestAirdrop(humanB.publicKey, 1_000_000_000);
      await provider.connection.confirmTransaction(sigB, "confirmed");

      await program.methods
        .signAgreementDirect(agreementId)
        .accounts({
          signer: humanB.publicKey,
          agreement: agPda,
          party: counterpartyPartyPda,
        })
        .signers([humanB])
        .rpc();

      // Verify agreement is now Active
      const agreement = await program.account.agreement.fetch(agPda);
      expect(agreement.status).to.equal(STATUS_ACTIVE);
      expect(agreement.numSigned).to.equal(2);

      const signedParty = await program.account.agreementParty.fetch(counterpartyPartyPda);
      expect(signedParty.signed).to.be.true;
    });
  });
});

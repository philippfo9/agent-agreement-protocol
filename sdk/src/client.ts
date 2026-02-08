import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  TransactionInstruction,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  findAgentIdentityPDA,
  findAgreementPDA,
  findAgreementPartyPDA,
} from "./pda";
import {
  RegisterAgentParams,
  ProposeAgreementParams,
  AddPartyParams,
  AgentIdentity,
  Agreement,
  AgreementParty,
  AgreementStatus,
  PartyRole,
} from "./types";

/**
 * High-level client for the Agent Agreement Protocol.
 *
 * For read operations, only a Connection is needed.
 * For write operations, pass an AnchorProvider with a wallet.
 */
export class AAPClient {
  public program: Program;
  public connection: Connection;
  public programId: PublicKey;

  constructor(program: Program) {
    this.program = program;
    this.connection = program.provider.connection;
    this.programId = program.programId;
  }

  // ── Read Methods ──

  async getAgentIdentity(agentKey: PublicKey): Promise<AgentIdentity | null> {
    const [pda] = findAgentIdentityPDA(agentKey, this.programId);
    try {
      const account = await (this.program.account as any).agentIdentity.fetch(pda);
      return account as unknown as AgentIdentity;
    } catch {
      return null;
    }
  }

  async getAgentIdentityByPDA(pda: PublicKey): Promise<AgentIdentity | null> {
    try {
      const account = await (this.program.account as any).agentIdentity.fetch(pda);
      return account as unknown as AgentIdentity;
    } catch {
      return null;
    }
  }

  async getAgreement(agreementId: Uint8Array | number[]): Promise<Agreement | null> {
    const [pda] = findAgreementPDA(agreementId, this.programId);
    try {
      const account = await (this.program.account as any).agreement.fetch(pda);
      return account as unknown as Agreement;
    } catch {
      return null;
    }
  }

  async getAgreementByPDA(pda: PublicKey): Promise<Agreement | null> {
    try {
      const account = await (this.program.account as any).agreement.fetch(pda);
      return account as unknown as Agreement;
    } catch {
      return null;
    }
  }

  async getAgreementParty(
    agreementId: Uint8Array | number[],
    agentIdentityPDA: PublicKey
  ): Promise<AgreementParty | null> {
    const [pda] = findAgreementPartyPDA(agreementId, agentIdentityPDA, this.programId);
    try {
      const account = await (this.program.account as any).agreementParty.fetch(pda);
      return account as unknown as AgreementParty;
    } catch {
      return null;
    }
  }

  async getAllAgents(): Promise<{ pubkey: PublicKey; account: AgentIdentity }[]> {
    const accounts = await (this.program.account as any).agentIdentity.all();
    return accounts.map((a: any) => ({
      pubkey: a.publicKey,
      account: a.account as unknown as AgentIdentity,
    }));
  }

  async getAllAgreements(): Promise<{ pubkey: PublicKey; account: Agreement }[]> {
    const accounts = await (this.program.account as any).agreement.all();
    return accounts.map((a: any) => ({
      pubkey: a.publicKey,
      account: a.account as unknown as Agreement,
    }));
  }

  async getAgreementsForAgent(
    agentIdentityPDA: PublicKey
  ): Promise<{ pubkey: PublicKey; account: AgreementParty }[]> {
    const parties = await (this.program.account as any).agreementParty.all([
      {
        memcmp: {
          offset: 8 + 32, // after discriminator + agreement pubkey
          bytes: agentIdentityPDA.toBase58(),
        },
      },
    ]);
    return parties.map((a: any) => ({
      pubkey: a.publicKey,
      account: a.account as unknown as AgreementParty,
    }));
  }

  // ── Write Methods ──

  async registerAgent(
    authority: PublicKey,
    params: RegisterAgentParams
  ): Promise<string> {
    const [agentIdentityPDA] = findAgentIdentityPDA(params.agentKey, this.programId);

    const scope = {
      canSignAgreements: params.scope.canSignAgreements,
      canCommitFunds: params.scope.canCommitFunds,
      maxCommitLamports: new BN(params.scope.maxCommitLamports.toString()),
      expiresAt: new BN(params.scope.expiresAt.toString()),
    };

    const tx = await this.program.methods
      .registerAgent(params.agentKey, Array.from(params.metadataHash), scope)
      .accounts({
        authority,
        agentIdentity: agentIdentityPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async proposeAgreement(
    proposerAgentKey: PublicKey,
    params: ProposeAgreementParams
  ): Promise<{ tx: string; agreementPDA: PublicKey; partyPDA: PublicKey }> {
    const [proposerIdentityPDA] = findAgentIdentityPDA(proposerAgentKey, this.programId);
    const agreementIdArr = Array.from(params.agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, proposerIdentityPDA, this.programId);

    const tx = await this.program.methods
      .proposeAgreement(
        agreementIdArr,
        params.agreementType,
        params.visibility,
        Array.from(params.termsHash),
        Array.from(params.termsUri),
        params.numParties,
        new BN(params.expiresAt.toString())
      )
      .accounts({
        proposerSigner: proposerAgentKey,
        proposerIdentity: proposerIdentityPDA,
        agreement: agreementPDA,
        proposerParty: partyPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, agreementPDA, partyPDA };
  }

  async addParty(
    proposerAgentKey: PublicKey,
    params: AddPartyParams
  ): Promise<string> {
    const [proposerIdentityPDA] = findAgentIdentityPDA(proposerAgentKey, this.programId);
    const agreementIdArr = Array.from(params.agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, params.partyIdentity, this.programId);

    const tx = await this.program.methods
      .addParty(agreementIdArr, params.role)
      .accounts({
        proposerSigner: proposerAgentKey,
        proposerIdentity: proposerIdentityPDA,
        agreement: agreementPDA,
        partyIdentity: params.partyIdentity,
        party: partyPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async signAgreement(
    signerAgentKey: PublicKey,
    agreementId: Uint8Array | number[]
  ): Promise<string> {
    const [signerIdentityPDA] = findAgentIdentityPDA(signerAgentKey, this.programId);
    const agreementIdArr = Array.from(agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, signerIdentityPDA, this.programId);

    const tx = await this.program.methods
      .signAgreement(agreementIdArr)
      .accounts({
        signer: signerAgentKey,
        signerIdentity: signerIdentityPDA,
        agreement: agreementPDA,
        party: partyPDA,
      })
      .rpc();

    return tx;
  }

  async cancelAgreement(
    signerKey: PublicKey,
    proposerAgentKey: PublicKey,
    agreementId: Uint8Array | number[]
  ): Promise<string> {
    const [proposerIdentityPDA] = findAgentIdentityPDA(proposerAgentKey, this.programId);
    const agreementIdArr = Array.from(agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);

    const tx = await this.program.methods
      .cancelAgreement(agreementIdArr)
      .accounts({
        signer: signerKey,
        proposerIdentity: proposerIdentityPDA,
        agreement: agreementPDA,
      })
      .rpc();

    return tx;
  }

  async fulfillAgreement(
    signerKey: PublicKey,
    signerAgentKey: PublicKey,
    agreementId: Uint8Array | number[]
  ): Promise<string> {
    const [signerIdentityPDA] = findAgentIdentityPDA(signerAgentKey, this.programId);
    const agreementIdArr = Array.from(agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, signerIdentityPDA, this.programId);

    const tx = await this.program.methods
      .fulfillAgreement(agreementIdArr)
      .accounts({
        signer: signerKey,
        signerIdentity: signerIdentityPDA,
        signerParty: partyPDA,
        agreement: agreementPDA,
      })
      .rpc();

    return tx;
  }

  async closeAgreement(
    authority: PublicKey,
    agentKey: PublicKey,
    agreementId: Uint8Array | number[]
  ): Promise<string> {
    const [signerIdentityPDA] = findAgentIdentityPDA(agentKey, this.programId);
    const agreementIdArr = Array.from(agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, signerIdentityPDA, this.programId);

    const tx = await this.program.methods
      .closeAgreement(agreementIdArr)
      .accounts({
        signer: authority,
        signerIdentity: signerIdentityPDA,
        signerParty: partyPDA,
        agreement: agreementPDA,
      })
      .rpc();

    return tx;
  }

  // ── Utility: Build unsigned transactions ──

  async buildRegisterAgentTx(
    authority: PublicKey,
    params: RegisterAgentParams
  ): Promise<Transaction> {
    const [agentIdentityPDA] = findAgentIdentityPDA(params.agentKey, this.programId);

    const scope = {
      canSignAgreements: params.scope.canSignAgreements,
      canCommitFunds: params.scope.canCommitFunds,
      maxCommitLamports: new BN(params.scope.maxCommitLamports.toString()),
      expiresAt: new BN(params.scope.expiresAt.toString()),
    };

    return await this.program.methods
      .registerAgent(params.agentKey, Array.from(params.metadataHash), scope)
      .accounts({
        authority,
        agentIdentity: agentIdentityPDA,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  }

  async buildProposeAgreementTx(
    proposerAgentKey: PublicKey,
    params: ProposeAgreementParams
  ): Promise<{ transaction: Transaction; agreementPDA: PublicKey }> {
    const [proposerIdentityPDA] = findAgentIdentityPDA(proposerAgentKey, this.programId);
    const agreementIdArr = Array.from(params.agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, proposerIdentityPDA, this.programId);

    const transaction = await this.program.methods
      .proposeAgreement(
        agreementIdArr,
        params.agreementType,
        params.visibility,
        Array.from(params.termsHash),
        Array.from(params.termsUri),
        params.numParties,
        new BN(params.expiresAt.toString())
      )
      .accounts({
        proposerSigner: proposerAgentKey,
        proposerIdentity: proposerIdentityPDA,
        agreement: agreementPDA,
        proposerParty: partyPDA,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return { transaction, agreementPDA };
  }

  async buildSignAgreementTx(
    signerAgentKey: PublicKey,
    agreementId: Uint8Array | number[]
  ): Promise<Transaction> {
    const [signerIdentityPDA] = findAgentIdentityPDA(signerAgentKey, this.programId);
    const agreementIdArr = Array.from(agreementId);
    const [agreementPDA] = findAgreementPDA(agreementIdArr, this.programId);
    const [partyPDA] = findAgreementPartyPDA(agreementIdArr, signerIdentityPDA, this.programId);

    return await this.program.methods
      .signAgreement(agreementIdArr)
      .accounts({
        signer: signerAgentKey,
        signerIdentity: signerIdentityPDA,
        agreement: agreementPDA,
        party: partyPDA,
      })
      .transaction();
  }
}

import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { AAP_IDL } from "./idl";
import {
  AgentIdentity,
  Agreement,
  AgreementParty,
  AgentIdentityAccount,
  AgreementAccount,
  AgreementPartyAccount,
} from "./types";

// Create a read-only provider
function getReadOnlyProvider(connection: Connection): AnchorProvider {
  return new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signAllTransactions: async <T,>(txs: T[]) => txs,
      signTransaction: async <T,>(tx: T) => tx,
    } as any,
    { commitment: "confirmed" }
  );
}

export function getProgram(connection: Connection): Program {
  const provider = getReadOnlyProvider(connection);
  return new Program(AAP_IDL as any as Idl, provider);
}

export async function fetchAgentIdentity(
  connection: Connection,
  pda: PublicKey
): Promise<AgentIdentity | null> {
  const program = getProgram(connection);
  try {
    const account = await (program.account as any).agentIdentity.fetch(pda);
    return account as AgentIdentity;
  } catch {
    return null;
  }
}

export async function fetchAllAgentsByAuthority(
  connection: Connection,
  authority: PublicKey
): Promise<AgentIdentityAccount[]> {
  const program = getProgram(connection);
  try {
    const accounts = await (program.account as any).agentIdentity.all([
      {
        memcmp: {
          offset: 8,
          bytes: authority.toBase58(),
        },
      },
    ]);
    return accounts as AgentIdentityAccount[];
  } catch {
    return [];
  }
}

export async function fetchAgreement(
  connection: Connection,
  pda: PublicKey
): Promise<Agreement | null> {
  const program = getProgram(connection);
  try {
    const account = await (program.account as any).agreement.fetch(pda);
    return account as Agreement;
  } catch {
    return null;
  }
}

export async function fetchAllAgreementParties(
  connection: Connection,
  agentIdentityPda: PublicKey
): Promise<AgreementPartyAccount[]> {
  const program = getProgram(connection);
  try {
    const accounts = await (program.account as any).agreementParty.all([
      {
        memcmp: {
          offset: 8 + 32,
          bytes: agentIdentityPda.toBase58(),
        },
      },
    ]);
    return accounts as AgreementPartyAccount[];
  } catch {
    return [];
  }
}

export async function fetchAllAgreements(
  connection: Connection
): Promise<AgreementAccount[]> {
  const program = getProgram(connection);
  try {
    return (await (program.account as any).agreement.all()) as AgreementAccount[];
  } catch {
    return [];
  }
}

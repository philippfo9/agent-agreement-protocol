"use client";

import useSWR from "swr";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  fetchAllAgentsByAuthority,
  fetchAgentIdentity,
  fetchAllAgreementParties,
  fetchAgreement,
} from "./program";
import { getAgentIdentityPDA } from "./pda";
import type {
  AgentIdentityAccount,
  AgreementAccount,
  AgentIdentity,
} from "./types";

const REFRESH_INTERVAL = 30_000; // 30s for on-chain data

// Stable key builders
function agentsKey(authority: PublicKey | null) {
  return authority ? `agents:${authority.toBase58()}` : null;
}

function agentKey(pubkey: string | null) {
  return pubkey ? `agent:${pubkey}` : null;
}

function agreementsKey(authority: PublicKey | null) {
  return authority ? `agreements:${authority.toBase58()}` : null;
}

export function useMyAgents() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useSWR(
    agentsKey(publicKey ?? null),
    () => fetchAllAgentsByAuthority(connection, publicKey!),
    { refreshInterval: REFRESH_INTERVAL }
  );
}

export function useAgentProfile(agentPubkeyStr: string) {
  const { connection } = useConnection();

  return useSWR(
    agentKey(agentPubkeyStr),
    async (): Promise<{ identity: AgentIdentity; pda: PublicKey } | null> => {
      const pubkey = new PublicKey(agentPubkeyStr);
      const [pda] = getAgentIdentityPDA(pubkey);
      const identity = await fetchAgentIdentity(connection, pda);
      return identity ? { identity, pda } : null;
    },
    { refreshInterval: REFRESH_INTERVAL }
  );
}

export function useAgentAgreements(agentPda: PublicKey | null) {
  const { connection } = useConnection();

  return useSWR(
    agentPda ? `agent-agreements:${agentPda.toBase58()}` : null,
    () => fetchAgreementsForAgent(connection, agentPda!),
    { refreshInterval: REFRESH_INTERVAL }
  );
}

export function useMyAgreements() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useSWR(
    agreementsKey(publicKey ?? null),
    async (): Promise<AgreementAccount[]> => {
      const agents = await fetchAllAgentsByAuthority(connection, publicKey!);
      if (agents.length === 0) return [];

      // Parallel: fetch all parties for all agents at once
      const allParties = await Promise.all(
        agents.map((agent) =>
          fetchAllAgreementParties(connection, agent.publicKey)
        )
      );

      // Deduplicate agreement PDAs via Set
      const seen = new Set<string>();
      const uniqueAgreementPdas: PublicKey[] = [];
      for (const parties of allParties) {
        for (const party of parties) {
          const key = party.account.agreement.toBase58();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueAgreementPdas.push(party.account.agreement);
          }
        }
      }

      // Parallel: fetch all agreements at once
      const results = await Promise.all(
        uniqueAgreementPdas.map(async (pda) => {
          const account = await fetchAgreement(connection, pda);
          return account ? { publicKey: pda, account } : null;
        })
      );

      return results
        .filter((r): r is AgreementAccount => r !== null)
        .toSorted(
          (a, b) =>
            b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
        );
    },
    { refreshInterval: REFRESH_INTERVAL }
  );
}

async function fetchAgreementsForAgent(
  connection: Connection,
  agentPda: PublicKey
): Promise<AgreementAccount[]> {
  const parties = await fetchAllAgreementParties(connection, agentPda);
  if (parties.length === 0) return [];

  const results = await Promise.all(
    parties.map(async (party) => {
      const account = await fetchAgreement(connection, party.account.agreement);
      return account
        ? { publicKey: party.account.agreement, account }
        : null;
    })
  );

  return results.filter((r): r is AgreementAccount => r !== null);
}

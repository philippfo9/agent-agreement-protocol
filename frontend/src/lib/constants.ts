import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("4G1njguyZNtTTrwoRjTah8MeNGjwNyEsTbA2198sJkDe");

export const AGREEMENT_TYPE_LABELS: Record<number, string> = {
  0: "SAFE",
  1: "Service",
  2: "Revenue Share",
  3: "Joint Venture",
  4: "Custom",
};

export const STATUS_LABELS: Record<number, string> = {
  0: "Proposed",
  1: "Active",
  2: "Fulfilled",
  3: "Breached",
  4: "Disputed",
  5: "Cancelled",
};

export const STATUS_COLORS: Record<number, string> = {
  0: "text-yellow-400",
  1: "text-green-400",
  2: "text-blue-400",
  3: "text-red-400",
  4: "text-orange-400",
  5: "text-gray-400",
};

export const STATUS_BG_COLORS: Record<number, string> = {
  0: "bg-yellow-400/10 border-yellow-400/30",
  1: "bg-green-400/10 border-green-400/30",
  2: "bg-blue-400/10 border-blue-400/30",
  3: "bg-red-400/10 border-red-400/30",
  4: "bg-orange-400/10 border-orange-400/30",
  5: "bg-gray-400/10 border-gray-400/30",
};

export const ROLE_LABELS: Record<number, string> = {
  0: "Proposer",
  1: "Counterparty",
  2: "Witness",
  3: "Arbitrator",
};

export const VISIBILITY_LABELS: Record<number, string> = {
  0: "Public",
  1: "Private",
};

export const NETWORKS = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
} as const;

export type NetworkName = keyof typeof NETWORKS;

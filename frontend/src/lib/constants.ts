import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("BzHyb5Eevigb6cyfJT5cd27zVhu92sY5isvmHUYe6NwZ");

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
  0: "text-gray-400",
  1: "text-gray-300",
  2: "text-gray-400",
  3: "text-gray-500",
  4: "text-gray-500",
  5: "text-gray-600",
};

export const STATUS_BG_COLORS: Record<number, string> = {
  0: "bg-white/5 border-white/10",
  1: "bg-white/10 border-white/15",
  2: "bg-white/8 border-white/12",
  3: "bg-white/5 border-white/10",
  4: "bg-white/5 border-white/10",
  5: "bg-white/5 border-white/8",
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

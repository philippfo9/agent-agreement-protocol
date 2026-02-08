import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export function shortenPubkey(pubkey: PublicKey | string, chars = 4): string {
  const s = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  return `${s.slice(0, chars)}...${s.slice(-chars)}`;
}

export function lamportsToSol(lamports: BN | number): string {
  const val = typeof lamports === "number" ? lamports : lamports.toNumber();
  return (val / 1e9).toFixed(4);
}

export function formatTimestamp(ts: BN | number): string {
  const val = typeof ts === "number" ? ts : ts.toNumber();
  if (val === 0) return "Never";
  return new Date(val * 1000).toLocaleString();
}

export function isExpired(expiresAt: BN | number): boolean {
  const val = typeof expiresAt === "number" ? expiresAt : expiresAt.toNumber();
  if (val === 0) return false;
  return Date.now() / 1000 > val;
}

export function isPubkeyDefault(pubkey: PublicKey): boolean {
  return pubkey.equals(PublicKey.default);
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToString(bytes: number[]): string {
  const end = bytes.indexOf(0);
  const slice = end === -1 ? bytes : bytes.slice(0, end);
  return new TextDecoder().decode(new Uint8Array(slice));
}

export function agreementIdToHex(id: number[]): string {
  return bytesToHex(id);
}

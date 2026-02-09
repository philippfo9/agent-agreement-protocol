import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Server-side: verify a signed message proves wallet ownership
export function verifyWalletSignature(
  walletPubkey: string,
  message: string,
  signature: string
): boolean {
  try {
    const pubkey = new PublicKey(walletPubkey);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkey.toBytes());
  } catch {
    return false;
  }
}

// The message format for auth — includes timestamp to prevent replay
export function buildAuthMessage(wallet: string, timestamp: number): string {
  return `AAP Auth: ${wallet} at ${timestamp}`;
}

// Server-side: verify auth headers and return wallet if valid
// Expects headers: x-wallet, x-signature, x-timestamp
export function verifyAuthHeaders(headers: {
  wallet: string | null;
  signature: string | null;
  timestamp: string | null;
}): { valid: boolean; wallet?: string; error?: string } {
  const { wallet, signature, timestamp } = headers;

  if (!wallet || !signature || !timestamp) {
    return { valid: false, error: "Missing auth headers (x-wallet, x-signature, x-timestamp)" };
  }

  const ts = parseInt(timestamp, 10);
  const now = Date.now();
  // Allow 5 minute window
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    return { valid: false, error: "Signature expired" };
  }

  const message = buildAuthMessage(wallet, ts);
  if (!verifyWalletSignature(wallet, message, signature)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true, wallet };
}

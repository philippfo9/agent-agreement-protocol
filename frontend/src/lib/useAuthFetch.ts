"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import bs58 from "bs58";
import { buildAuthMessage } from "./auth";

// Hook that provides an authenticated fetch function
// Signs a message with the connected wallet and includes auth headers
export function useAuthFetch() {
  const { publicKey, signMessage } = useWallet();

  const authFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      if (!publicKey || !signMessage) {
        throw new Error("Wallet not connected or doesn't support message signing");
      }

      const wallet = publicKey.toBase58();
      const timestamp = Date.now();
      const message = buildAuthMessage(wallet, timestamp);
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      const headers = new Headers(init?.headers);
      headers.set("x-wallet", wallet);
      headers.set("x-signature", signature);
      headers.set("x-timestamp", timestamp.toString());

      return fetch(url, { ...init, headers });
    },
    [publicKey, signMessage]
  );

  return { authFetch, canSign: !!publicKey && !!signMessage };
}

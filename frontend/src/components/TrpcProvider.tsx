"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { trpc } from "@/lib/trpc";
import { buildAuthMessage } from "@/lib/auth";

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [queryClient] = useState(() => new QueryClient());

  // Cache signed auth headers (valid 5 min)
  const authCache = useRef<{ headers: Record<string, string>; expiresAt: number } | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!publicKey || !signMessage) return {};

    // Use cached if still valid (with 30s buffer)
    if (authCache.current && authCache.current.expiresAt > Date.now() + 30_000) {
      return authCache.current.headers;
    }

    try {
      const wallet = publicKey.toBase58();
      const timestamp = Date.now();
      const message = buildAuthMessage(wallet, timestamp);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const headers = {
        "x-wallet": wallet,
        "x-signature": bs58.encode(sigBytes),
        "x-timestamp": timestamp.toString(),
      };
      authCache.current = { headers, expiresAt: timestamp + 4 * 60 * 1000 };
      return headers;
    } catch {
      return {};
    }
  }, [publicKey, signMessage]);

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          async headers() {
            return getAuthHeaders();
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

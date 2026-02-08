"use client";

import { useMemo, useState, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { NetworkContext, NetworkContextType } from "@/lib/network";
import { NETWORKS, NetworkName } from "@/lib/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkName>("devnet");
  const endpoint = NETWORKS[network];

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  const networkCtx: NetworkContextType = useMemo(
    () => ({ network, setNetwork, endpoint }),
    [network, endpoint]
  );

  return (
    <NetworkContext.Provider value={networkCtx}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}

"use client";

import { createContext, useContext } from "react";
import { NetworkName } from "./constants";

export interface NetworkContextType {
  network: NetworkName;
  setNetwork: (n: NetworkName) => void;
  endpoint: string;
}

export const NetworkContext = createContext<NetworkContextType>({
  network: "devnet",
  setNetwork: () => {},
  endpoint: "https://api.devnet.solana.com",
});

export function useNetwork() {
  return useContext(NetworkContext);
}

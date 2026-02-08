"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetwork } from "@/lib/network";
import { NetworkName } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/", label: "My Agents" },
  { href: "/agreements", label: "Agreements" },
  { href: "/explore", label: "Explore" },
  { href: "/emergency", label: "Emergency", danger: true },
];

export function Navbar() {
  const pathname = usePathname();
  const { network, setNetwork } = useNetwork();

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-purple-400">AAP</span>
            <span className="text-gray-500 text-sm font-normal hidden sm:inline">
              Agent Agreement Protocol
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? item.danger
                      ? "bg-red-500/10 text-red-400"
                      : "bg-purple-500/10 text-purple-400"
                    : item.danger
                    ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/5"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {item.danger && "⚠ "}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value as NetworkName)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="devnet">Devnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}

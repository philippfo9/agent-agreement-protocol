"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetwork } from "@/lib/network";
import { NetworkName } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/", label: "Agents" },
  { href: "/agreements", label: "Agreements" },
  { href: "/explore", label: "Explore" },
  { href: "/emergency", label: "Emergency", danger: true },
];

export function Navbar() {
  const pathname = usePathname();
  const { network, setNetwork } = useNetwork();

  return (
    <nav className="border-b border-white/[0.06] bg-surface-dark/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-white">AAP</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? item.danger
                        ? "bg-red-500/10 text-red-400"
                        : "bg-white/[0.08] text-white"
                      : item.danger
                      ? "text-red-400/50 hover:text-red-400 hover:bg-red-500/5"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value as NetworkName)}
            className="bg-surface border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:ring-1 focus:ring-accent"
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

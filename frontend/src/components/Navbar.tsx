"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetwork } from "@/lib/network";
import { useTheme } from "@/lib/theme";
import { NetworkName } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/", label: "Agents" },
  { href: "/agreements", label: "Agreements" },
  { href: "/explore", label: "Explore" },
  { href: "/emergency", label: "Emergency", danger: true },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-lg flex items-center justify-center border border-shell-border hover:bg-shell-hover-strong transition-all duration-200"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="w-4 h-4 text-shell-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-shell-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <button
      className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center border border-shell-border hover:bg-shell-hover-strong transition-all duration-200"
      aria-label={open ? "Close menu" : "Open menu"}
    >
      {open ? (
        <svg className="w-5 h-5 text-shell-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-shell-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { network, setNetwork } = useNetwork();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const toggleMenu = useCallback(() => setMobileOpen((p) => !p), []);

  return (
    <>
      <nav className="border-b border-shell-border bg-[var(--navbar-bg)] backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm">
                A
              </div>
              <span className="font-bold text-lg tracking-tight text-shell-heading">
                AAP
              </span>
            </Link>
            {/* Desktop nav items */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? item.danger
                          ? "bg-white/10 text-gray-400"
                          : "bg-shell-hover-strong text-shell-heading"
                        : item.danger
                        ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        : "text-shell-muted hover:text-shell-fg hover:bg-shell-hover"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Desktop controls + Mobile hamburger */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Desktop-only controls */}
            <div className="hidden md:flex items-center gap-3">
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as NetworkName)}
                className="bg-input border border-input-border rounded-lg px-3 py-2 text-sm text-shell-muted focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <option value="devnet">Devnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
              <WalletMultiButton />
            </div>
            {/* Mobile hamburger */}
            <div onClick={toggleMenu}>
              <HamburgerIcon open={mobileOpen} />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Slide-in panel */}
          <div className="fixed top-14 right-0 bottom-0 w-72 bg-[var(--navbar-bg)] backdrop-blur-xl border-l border-shell-border z-50 md:hidden overflow-y-auto animate-slide-in-right">
            <div className="p-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] flex items-center ${
                      isActive
                        ? item.danger
                          ? "bg-white/10 text-gray-400"
                          : "bg-shell-hover-strong text-shell-heading"
                        : item.danger
                        ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        : "text-shell-muted hover:text-shell-fg hover:bg-shell-hover"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-shell-border p-4 space-y-4">
              <div>
                <div className="text-xs text-shell-dim uppercase tracking-wider mb-2 px-1">Network</div>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as NetworkName)}
                  className="w-full bg-input border border-input-border rounded-lg px-3 py-2.5 text-sm text-shell-muted focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value="devnet">Devnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-shell-dim uppercase tracking-wider mb-2 px-1">Wallet</div>
                <WalletMultiButton />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

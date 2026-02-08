import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Loading } from "@/components/Loading";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AAP — Agent Agreement Protocol",
  description: "On-chain agent identity & agreement management on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-surface-dark text-gray-100 min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="max-w-6xl mx-auto px-6 py-12">
            <Suspense fallback={<Loading />}>
              {children}
            </Suspense>
          </main>
          <footer className="border-t border-white/[0.04] mt-24">
            <div className="max-w-6xl mx-auto px-6 py-8 text-center">
              <p className="text-sm text-gray-600">
                Agent Agreement Protocol — On-chain agent identity & agreements on Solana
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

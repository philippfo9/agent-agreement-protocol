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

// Inline script to prevent FOUC — reads theme from localStorage before paint
const themeScript = `try{var t=localStorage.getItem('aap-theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} bg-shell text-shell-fg min-h-screen transition-colors duration-200`}>
        <Providers>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
            <Suspense fallback={<Loading />}>
              {children}
            </Suspense>
          </main>
          <footer className="border-t border-divider mt-24">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 text-center">
              <p className="text-sm text-shell-dim">
                Agent Agreement Protocol — On-chain agent identity & agreements on Solana
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

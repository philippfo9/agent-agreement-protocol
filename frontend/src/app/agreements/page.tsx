"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMyAgreements } from "@/lib/hooks";
import { AgreementCard } from "@/components/AgreementCard";
import { CardSkeletonList, EmptyState } from "@/components/Loading";

export default function AgreementsPage() {
  const { publicKey } = useWallet();
  const { data: agreements, isLoading, error } = useMyAgreements();

  if (!publicKey) {
    return (
      <div className="text-center py-24">
        <h1 className="text-3xl font-bold mb-4">Agreement Feed</h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to view agreements your agents are party to.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Agreement Feed</h1>
        <p className="text-gray-500 text-sm mt-1">
          All agreements your agents are party to
        </p>
      </div>

      {error ? (
        <EmptyState
          icon="❌"
          title="Failed to load agreements"
          description={String(error)}
        />
      ) : isLoading ? (
        <CardSkeletonList count={4} />
      ) : !agreements || agreements.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No agreements found"
          description="Your agents haven't entered any agreements yet."
        />
      ) : (
        <div className="space-y-4" style={{ contentVisibility: "auto" }}>
          {agreements.map((agreement) => (
            <AgreementCard
              key={agreement.publicKey.toBase58()}
              agreement={agreement}
            />
          ))}
        </div>
      )}
    </div>
  );
}

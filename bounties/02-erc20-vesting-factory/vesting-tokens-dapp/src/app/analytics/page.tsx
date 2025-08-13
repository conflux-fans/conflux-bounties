// src/app/analytics/page.tsx
"use client";

import { useAccount } from "wagmi";
import { Navbar } from "@/components/layout/navbar";
import { ConnectWalletPrompt } from "@/components/web3/connect-wallet-prompt";
import { AnalyticsOverview } from "@/components/analytics/analytics-overview";
import { TokensList } from "@/components/analytics/tokens-list";

export default function AnalyticsPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <>
        <Navbar />
        <ConnectWalletPrompt />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">
            Monitor your token deployments and vesting performance
          </p>
        </div>

        <div className="space-y-8">
          <AnalyticsOverview />
          <TokensList />
        </div>
      </div>
    </>
  );
}

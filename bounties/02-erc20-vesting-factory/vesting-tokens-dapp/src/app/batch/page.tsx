// src/app/batch/page.tsx
"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { BatchDeploymentWizard } from "@/components/batch/batch-deployment-wizard";
import { Navbar } from "@/components/layout/navbar";
import { ConnectWalletPrompt } from "@/components/web3/connect-wallet-prompt";

export default function BatchDeployPage() {
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
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Batch Token Deployment</h1>
            <p className="text-muted-foreground">
              Deploy multiple tokens with vesting schedules in a single
              transaction. Import from CSV or configure manually.
            </p>
          </div>
          <BatchDeploymentWizard />
        </div>
      </div>
    </>
  );
}

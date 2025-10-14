// src/app/deploy/page.tsx
"use client";


import { useAccount } from "wagmi";
import { DeploymentWizard } from "@/components/deploy/deployment-wizard";
import { Navbar } from "@/components/layout/navbar";
import { ConnectWalletPrompt } from "@/components/web3/connect-wallet-prompt";

export default function DeployPage() {
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Deploy Token with Vesting
            </h1>
            <p className="text-muted-foreground">
              Create your ERC20 token and configure vesting schedules in a
              single transaction
            </p>
          </div>
          <DeploymentWizard />
        </div>
      </div>
    </>
  );
}

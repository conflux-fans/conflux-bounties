// src/app/dashboard/page.tsx
"use client";

import { useAccount } from "wagmi";
import { Navbar } from "@/components/layout/navbar";
import { ConnectWalletPrompt } from "@/components/web3/connect-wallet-prompt";
import { AdminTokenManagement } from "@/components/dashboard/AdminTokenManagement";

export default function DashboardPage() {
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
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your token deployments and vesting schedules
          </p>
        </div>

        <div className="">
          <AdminTokenManagement />
        </div>
      </div>
    </>
  );
}

// src/app/beneficiary/page.tsx
"use client";

import { useAccount } from "wagmi";
import { Navbar } from "@/components/layout/navbar";
import { ConnectWalletPrompt } from "@/components/web3/connect-wallet-prompt";
import { BeneficiaryDashboard } from "@/components/beneficiary/beneficiary-dashboard";
import { VestingSchedulesList } from "@/components/beneficiary/vesting-schedules-list";
import { ClaimHistory } from "@/components/beneficiary/claim-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BeneficiaryPage() {
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
          <h1 className="text-3xl font-bold mb-2">Beneficiary Portal</h1>
          <p className="text-muted-foreground">
            View and manage your vested tokens
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedules">Vesting Schedules</TabsTrigger>
            <TabsTrigger value="history">Claim History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <BeneficiaryDashboard />
          </TabsContent>

          <TabsContent value="schedules">
            <VestingSchedulesList />
          </TabsContent>

          <TabsContent value="history">
            <ClaimHistory />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

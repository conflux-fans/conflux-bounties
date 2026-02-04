"use client";

import { useAccount } from "wagmi";
import { Sidebar } from "@/components/sidebar";
import { SubmissionForm } from "@/components/submission-form";
import { LandingPage } from "@/components/landing-page";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function SubmitPage() {
  const { isConnected } = useAccount();

  if (!isConnected) return <LandingPage />;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center text-sm text-zinc-500">
            <span className="mr-2">Conflux eSpace</span>
            <span className="font-mono bg-zinc-100 px-2 py-1 text-black">Testnet</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </div>
        </header>

        <div className="p-6 md:p-12 max-w-6xl mx-auto">
          <SubmissionForm />
        </div>
      </main>
    </div>
  );
}

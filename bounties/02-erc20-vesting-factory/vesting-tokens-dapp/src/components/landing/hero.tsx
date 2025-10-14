// src/components/landing/hero.tsx
"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, Shield, Zap } from "lucide-react";
import Link from "next/link";

export function Hero() {
  const { isConnected } = useAccount();

  return (
    <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Deploy Tokens with
            <span className="text-primary"> Smart Vesting</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create ERC20 tokens with built-in vesting schedules for your team,
            investors, and community. Deploy both token and vesting contracts in
            a single transaction.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {isConnected ? (
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/deploy">
                  Deploy Your Token
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button
                    onClick={openConnectModal}
                    size="lg"
                    className="text-lg px-8"
                  >
                    Connect Wallet to Start
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </ConnectButton.Custom>
            )}
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8"
              asChild
            >
              <Link href="/beneficiary">View My Tokens</Link>
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Single Transaction</h3>
              <p className="text-sm text-muted-foreground">
                Deploy token and vesting contracts together, saving gas and time
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Battle Tested</h3>
              <p className="text-sm text-muted-foreground">
                Built with OpenZeppelin contracts and security best practices
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Flexible Vesting</h3>
              <p className="text-sm text-muted-foreground">
                Support for cliff periods, linear vesting, and custom schedules
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

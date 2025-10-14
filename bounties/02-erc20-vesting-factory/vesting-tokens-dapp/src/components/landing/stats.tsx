// src/components/landing/stats.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

export function Stats() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = [
    {
      value: "500+",
      label: "Tokens Deployed",
      description: "Successfully launched with vesting",
    },
    {
      value: "$50M+",
      label: "Total Value Locked",
      description: "In vesting contracts",
    },
    {
      value: "10K+",
      label: "Beneficiaries",
      description: "Managing their vested tokens",
    },
    {
      value: "99.9%",
      label: "Uptime",
      description: "Reliable infrastructure",
    },
  ];

  if (!mounted) {
    return null;
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Trusted by Projects Worldwide
          </h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Join hundreds of projects that have successfully deployed tokens
            with our platform
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="bg-primary-foreground/10 border-primary-foreground/20"
            >
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="font-semibold mb-1">{stat.label}</div>
                <div className="text-sm opacity-80">{stat.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

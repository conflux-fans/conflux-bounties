// src/components/landing/how-it-works.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Coins, Users, BarChart3 } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      step: 1,
      icon: Coins,
      title: "Configure Your Token",
      description:
        "Set token name, symbol, total supply, and initial distribution parameters.",
      details: ["Token metadata", "Supply allocation", "Distribution rules"],
    },
    {
      step: 2,
      icon: Users,
      title: "Setup Vesting Schedules",
      description:
        "Create different vesting schedules for teams, investors, and other stakeholders.",
      details: ["Cliff periods", "Linear vesting", "Custom schedules"],
    },
    {
      step: 3,
      icon: CheckCircle,
      title: "Deploy Contracts",
      description:
        "Deploy both token and vesting contracts in a single gas-optimized transaction.",
      details: [
        "Single transaction",
        "Gas optimized",
        "Automatic verification",
      ],
    },
    {
      step: 4,
      icon: BarChart3,
      title: "Monitor & Manage",
      description:
        "Track vesting progress, manage claims, and generate comprehensive reports.",
      details: [
        "Real-time tracking",
        "Automated claims",
        "Analytics dashboard",
      ],
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simple four-step process to deploy your token with vesting schedules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <Badge variant="default" className="mr-3">
                      {step.step}
                    </Badge>
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground mb-4">
                    {step.description}
                  </p>
                  <ul className="space-y-2">
                    {step.details.map((detail, detailIndex) => (
                      <li
                        key={detailIndex}
                        className="flex items-center text-sm"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 right-0 w-8 h-px bg-border transform translate-x-full -translate-y-1/2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

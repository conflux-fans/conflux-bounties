// src/components/landing/features.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  Users,
  BarChart3,
  Upload,
  Shield,
  Zap,
  FileText,
  Settings,
} from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Clock,
      title: "Flexible Vesting Schedules",
      description:
        "Create cliff periods, linear vesting, or combined schedules for different stakeholder groups.",
    },
    {
      icon: Users,
      title: "Multi-Beneficiary Support",
      description:
        "Manage vesting for teams, investors, advisors, and community members with individual schedules.",
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description:
        "Track vesting progress, claim history, and distribution analytics in beautiful dashboards.",
    },
    {
      icon: Upload,
      title: "Batch Operations",
      description:
        "Deploy multiple tokens and upload beneficiary lists via CSV for large-scale operations.",
    },
    {
      icon: Shield,
      title: "Security First",
      description:
        "Built with OpenZeppelin contracts, audit-ready code, and comprehensive security measures.",
    },
    {
      icon: Zap,
      title: "Gas Optimized",
      description:
        "Minimal proxy pattern reduces deployment costs by up to 90% compared to traditional methods.",
    },
    {
      icon: FileText,
      title: "Comprehensive Reports",
      description:
        "Generate detailed reports for compliance, tax purposes, and stakeholder communications.",
    },
    {
      icon: Settings,
      title: "Advanced Controls",
      description:
        "Revocable vesting, emergency controls, and granular permission management.",
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/50">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Everything You Need for Token Vesting
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive toolset for creating, managing, and monitoring token
            vesting schedules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

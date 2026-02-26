import Link from "next/link";
import { ArrowRight, Sparkles, Database, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-6 py-24 md:py-32 lg:py-40">
        <div className="flex max-w-[980px] flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Powered by AI</span>
          </div>
          
          <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-6xl lg:text-7xl lg:leading-[1.1]">
            Your Conflux Blockchain
            <br className="hidden sm:inline" />
            <span className="text-blue-600">
              {" "}Expert Assistant
            </span>
          </h1>
          
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Get authoritative answers about Conflux with AI-powered search across documentation,
            repos, and live network data. Every answer cited, every fact verified.
          </p>
          
          <div className="flex gap-4 mt-4">
            <Button asChild size="lg" className="h-12 px-8">
              <Link href="/chat">
                Start Chatting <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8">
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-24 bg-muted/40">
        <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center mb-16">
          <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl">
            Why Conflux Expert?
          </h2>
          <p className="max-w-[750px] text-lg text-muted-foreground">
            Built for developers, by developers. Get accurate, cited answers instantly.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Database className="h-8 w-8 text-primary" />}
            title="RAG-Powered Search"
            description="Search across curated Conflux docs, repos, and resources with semantic understanding."
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-primary" />}
            title="Live Network Data"
            description="Query real-time blockchain data from ConfluxScan API for up-to-date information."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Cited Sources"
            description="Every answer includes citations linking back to original sources for verification."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24">
        <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl">
            Ready to explore Conflux?
          </h2>
          <p className="max-w-[750px] text-lg text-muted-foreground">
            Start asking questions and get expert answers in seconds.
          </p>
          <Button asChild size="lg" className="mt-4 h-12 px-8">
            <Link href="/chat">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-background p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-muted p-3 w-fit">{icon}</div>
        <div className="space-y-2">
          <h3 className="font-semibold text-xl">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

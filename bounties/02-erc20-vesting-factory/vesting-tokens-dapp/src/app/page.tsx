// src/app/page.tsx
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Stats } from "@/components/landing/stats";
import { Footer } from "@/components/layout/footer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Hero />
          <Features />
          <Stats />
          <HowItWorks />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

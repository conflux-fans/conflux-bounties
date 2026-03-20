import { Suspense } from "react";
import { SignInPanel } from "@/components/sign-in-panel";
import { PageShell } from "@/components/ui/page-shell";

export default function LoginPage() {
  return (
    <PageShell
      size="sm"
      className="flex min-h-[calc(100vh-12rem)] flex-col justify-center py-12 sm:py-16"
      eyebrow="Authentication"
      title="Sign in"
      description="Connect on Conflux eSpace, then sign a SIWE-compatible message. Your session is separate from “wallet connected” in the header."
    >
      <div className="mt-10">
        <Suspense
          fallback={
            <div className="ui-card animate-pulse">
              <div className="h-5 w-32 rounded bg-paper" />
              <div className="mt-4 h-24 rounded-xl bg-paper" />
            </div>
          }
        >
          <SignInPanel />
        </Suspense>
      </div>
    </PageShell>
  );
}

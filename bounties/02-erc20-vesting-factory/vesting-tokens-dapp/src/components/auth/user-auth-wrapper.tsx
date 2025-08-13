// src/components/auth/user-auth-wrapper.tsx
"use client";

import { ReactNode, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { FirstTimeUserWelcome } from "./first-time-user-welcome";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface UserAuthWrapperProps {
  children: ReactNode;
}

export function UserAuthWrapper({ children }: UserAuthWrapperProps) {
  const { isConnected } = useAccount();
  const { user, isLoading, isNewUser } = useUserAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user && isNewUser) {
      setShowWelcome(true);
    }
  }, [user, isNewUser]);

  // Don't show anything if wallet is not connected
  if (!isConnected) {
    return <>{children}</>;
  }

  // Show loading while fetching user data
  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <>
      {children}
      <FirstTimeUserWelcome
        isOpen={showWelcome}
        onComplete={() => setShowWelcome(false)}
      />
    </>
  );
}

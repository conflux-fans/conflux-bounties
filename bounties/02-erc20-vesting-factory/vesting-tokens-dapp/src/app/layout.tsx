import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { UserAuthWrapper } from "@/components/auth/user-auth-wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Token Vesting DApp",
  description: "Deploy and manage ERC20 tokens with vesting schedules",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <UserAuthWrapper>{children}</UserAuthWrapper>
        </Providers>
      </body>
    </html>
  );
}

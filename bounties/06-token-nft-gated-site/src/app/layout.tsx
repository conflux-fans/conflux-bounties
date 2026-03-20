import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { getSession } from "@/lib/auth/get-session";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Conflux Token / NFT Gated Demo",
  description:
    "Next.js boilerplate: SIWE auth, ERC20/721/1155 gating, admin rules, Conflux eSpace",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const signedIn = Boolean(session);

  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <AppProviders>
          <AppHeader signedIn={signedIn} />
          <div className="flex-1">{children}</div>
          <AppFooter />
        </AppProviders>
      </body>
    </html>
  );
}

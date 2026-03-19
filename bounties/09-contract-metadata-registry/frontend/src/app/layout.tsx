import type { Metadata } from "next";
import { headers } from "next/headers";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import { getConfig } from "../lib/config";
import { Providers } from "../components/Providers";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conflux Metadata Registry",
  description: "Verified metadata registry for Conflux smart contracts. Register, explore, and verify contract metadata on-chain.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const initialState = cookieToInitialState(getConfig(), cookie);

  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <Providers initialState={initialState}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conflux Contract Metadata Registry",
  description:
    "Canonical metadata registry for verifying, storing, and discovering smart contracts on Conflux eSpace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans text-zinc-900 antialiased selection:bg-black selection:text-white`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

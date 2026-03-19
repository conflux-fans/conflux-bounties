import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import { NavBar } from '@/components/shared/NavBar';
import { WagmiProvider } from './providers';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Conflux Automation Site',
  description: 'Non-custodial limit orders & DCA on Conflux eSpace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jbMono.variable}`}>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-conflux-500/30">
        <WagmiProvider>
          <NavBar />
          <main className="mx-auto max-w-7xl px-4 py-8 md:py-12">
            {children}
          </main>
        </WagmiProvider>
      </body>
    </html>
  );
}

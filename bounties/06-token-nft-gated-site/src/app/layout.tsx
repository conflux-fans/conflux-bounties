import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Conflux Gated Site', description: 'Token/NFT Gated Content on Conflux eSpace' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-200">
        <nav className="border-b border-slate-700 p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-cyan-400">🔐 Conflux Gated Site</h1>
          <div className="flex gap-4">
            <a href="/" className="hover:text-cyan-400">Home</a>
            <a href="/protected" className="hover:text-cyan-400">Protected</a>
            <a href="/admin" className="hover:text-cyan-400">Admin</a>
            <button id="connectBtn" className="bg-cyan-600 px-3 py-1 rounded hover:bg-cyan-500 text-sm">Connect Wallet</button>
          </div>
        </nav>
        <main className="p-8">{children}</main>
      </body>
    </html>
  )
}

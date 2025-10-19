import React from 'react';
import WalletConnect from './WalletConnect';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Logo image */}
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <img 
                  src="/confi.png" 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Pyth Price Feed
                </h1>
                <p className="text-sm text-gray-600">
                  Conflux eSpace Integration
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-white mt-12 border-t border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <p>Pyth Price Feed Demo Dapp - Testing Purpose</p>
            </div>
            <div className="flex space-x-6">
              <a href="https://docs.pyth.network" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                Pyth Docs
              </a>
              <a href="https://doc.confluxnetwork.org" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                Conflux Docs
              </a>
              <a href="https://github.com/AmirMP12" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
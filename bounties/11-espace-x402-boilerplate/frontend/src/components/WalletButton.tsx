'use client';

import { shortAddress } from '@/lib/wallet';

interface WalletButtonProps {
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function WalletButton({ address, connecting, onConnect, onDisconnect }: WalletButtonProps) {
  if (address) {
    return (
      <button
        onClick={onDisconnect}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition"
      >
        <span className="w-2 h-2 rounded-full bg-green-400" />
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

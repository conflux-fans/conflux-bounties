'use client';

import type { Token } from '@/lib/networks';

interface TokenSelectorProps {
  tokens: Token[];
  selected: string;
  onChange: (symbol: string) => void;
}

const METHOD_BADGE: Record<string, { label: string; color: string }> = {
  native: { label: 'Native', color: 'bg-green-600' },
  eip3009: { label: 'EIP-3009', color: 'bg-purple-600' },
  erc20: { label: 'ERC-20', color: 'bg-blue-600' },
};

export default function TokenSelector({ tokens, selected, onChange }: TokenSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
      {tokens.map((token) => {
        const badge = METHOD_BADGE[token.paymentMethod];
        const isActive = selected === token.symbol;
        return (
          <button
            key={token.symbol}
            onClick={() => onChange(token.symbol)}
            className={`relative p-3 rounded-lg border text-left transition ${
              isActive
                ? 'border-blue-500 bg-blue-950/50 ring-1 ring-blue-500'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <div className="font-semibold text-sm">{token.symbol}</div>
            <div className="text-xs text-gray-500">{token.name}</div>
            <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full text-white ${badge.color}`}>
              {badge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

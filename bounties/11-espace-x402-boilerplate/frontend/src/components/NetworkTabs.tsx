'use client';

interface NetworkTabsProps {
  active: string;
  onChange: (network: string) => void;
}

export default function NetworkTabs({ active, onChange }: NetworkTabsProps) {
  const tabs = [
    { id: 'testnet', label: 'Testnet', chainId: 71 },
    { id: 'mainnet', label: 'Mainnet', chainId: 1030 },
  ];

  return (
    <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            active === tab.id
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {tab.label}
          <span className="text-xs ml-1 opacity-60">({tab.chainId})</span>
        </button>
      ))}
    </div>
  );
}

import { WalletConnect } from '@/components/WalletConnect';
import { SiwcButton } from '@/components/SiwcButton';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8 py-16">
      <h1 className="text-4xl font-bold">Token-Gated Content on Conflux</h1>
      <p className="max-w-xl text-center text-gray-400">
        Connect your wallet, sign in with Conflux (SIWC), and access content gated by
        ERC20, ERC721, or ERC1155 token ownership on Conflux eSpace.
      </p>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-700 p-8">
        <h2 className="text-xl font-semibold">1. Connect Wallet</h2>
        <WalletConnect />

        <h2 className="mt-4 text-xl font-semibold">2. Sign In</h2>
        <SiwcButton />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mt-8">
        {[
          { title: 'ERC20 Gating', desc: 'Require minimum token balance to access content.' },
          { title: 'NFT Gating', desc: 'Gate pages behind ERC721 or ERC1155 ownership.' },
          { title: 'Admin Dashboard', desc: 'Manage rules, view logs, no redeploy needed.' },
        ].map((card) => (
          <div key={card.title} className="rounded-lg border border-gray-700 p-6">
            <h3 className="font-semibold text-conflux-accent">{card.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

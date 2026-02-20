import { WalletConnect } from '@/components/WalletConnect';
import { SiwcButton } from '@/components/SiwcButton';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <h1 className="text-3xl font-bold">Sign In</h1>
      <p className="text-gray-400">Connect your wallet and sign a message to authenticate.</p>

      <div className="flex flex-col items-center gap-6 rounded-lg border border-gray-700 p-8 w-full max-w-md">
        <WalletConnect />
        <hr className="w-full border-gray-700" />
        <SiwcButton />
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { Connector } from 'wagmi';
import { useWallet } from '../hooks/useWallet';
import { supportedChain } from '../lib/config';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

const METAMASK_URL = 'https://metamask.io/';

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  const {
    address,
    isConnected,
    chainId,
    isCorrectChain,
    connectors,
    connect,
    disconnect,
    switchChain,
    isConnecting,
    isSwitchingChain,
    error: wagmiError,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [noWalletTried, setNoWalletTried] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayError = wagmiError ?? localError;
  const showNoWalletHelp = noWalletTried && !connectors.length;
  const showErrorPanel = (displayError || showNoWalletHelp) && !dropdownOpen;

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  const openDropdown = useCallback(() => {
    setLocalError(null);
    setDropdownOpen(true);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen, closeDropdown]);

  const handleConnect = useCallback(
    async (connector: Connector | undefined) => {
      setLocalError(null);
      if (!connector) {
        setNoWalletTried(true);
        setLocalError('No wallet detected. Install a wallet (e.g. MetaMask or Fluent), then refresh and try again.');
        return;
      }
      try {
        await connect(connector);
        closeDropdown();
      } catch {}
    },
    [connect, closeDropdown]
  );

  const handleCopyAddress = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [address]);

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isCorrectChain && (
          <Badge variant="warning" className="shrink-0">
            Wrong network
          </Badge>
        )}
        <div className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]/80 py-1 pl-2 pr-1">
          <button
            type="button"
            onClick={handleCopyAddress}
            className="max-w-[100px] truncate font-mono text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors sm:max-w-[140px]"
            title={address}
            aria-label={`Copy address ${address}`}
          >
            {formatAddress(address)}
          </button>
          <span
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded transition-opacity',
              copySuccess ? 'text-[rgb(var(--color-success))]' : 'text-[rgb(var(--color-text-muted))]'
            )}
            aria-live="polite"
          >
            {copySuccess ? 'Copied!' : ''}
          </span>
        </div>
        {!isCorrectChain && (
          <Button
            variant="primary"
            size="sm"
            loading={isSwitchingChain}
            disabled={isSwitchingChain}
            onClick={() => void switchChain()}
            aria-label={`Switch to ${supportedChain.name}`}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{isSwitchingChain ? 'Switching…' : `Switch to ${supportedChain.name}`}</span>
            <span className="sm:hidden">{isSwitchingChain ? '…' : 'Switch'}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          aria-label="Disconnect wallet"
          className="shrink-0 text-xs sm:text-sm"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  const list = connectors.length > 0 ? [...connectors] : [];
  const hasWallets = list.length > 0;

  return (
    <div className="relative flex flex-col items-end gap-2 min-w-0" ref={dropdownRef}>
      <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
        <Button
          variant="primary"
          onClick={hasWallets ? openDropdown : () => handleConnect(undefined)}
          disabled={isConnecting}
          loading={isConnecting}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={hasWallets ? 'Choose wallet to connect' : 'Connect wallet (no wallet detected)'}
        >
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </Button>
      </div>

      {dropdownOpen && hasWallets && (
        <div
          className="absolute right-0 top-full z-[200] mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-2 shadow-lg"
          role="listbox"
          aria-label="Wallet options"
        >
          {list.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => void handleConnect(connector)}
              disabled={isConnecting}
              className={clsx(
                'w-full px-4 py-2.5 text-left text-sm font-medium text-[rgb(var(--color-text))]',
                'hover:bg-[rgb(var(--color-bg-muted))]/50 transition-colors',
                isConnecting && 'opacity-70 cursor-wait'
              )}
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}

      {isConnecting && (
        <p className="max-w-[280px] text-left text-xs text-[rgb(var(--color-text-muted))]">
          Check your wallet extension or popup to approve the connection.
        </p>
      )}

      {showErrorPanel && (
        <div
          className="w-full max-w-[280px] rounded-lg border border-[rgb(var(--color-danger))]/50 bg-[rgb(var(--color-danger))]/10 p-3 text-left text-sm text-[rgb(var(--color-danger))]"
          role="alert"
        >
          {showNoWalletHelp && (
            <>
              <p className="font-medium">No wallet detected</p>
              <p className="mt-1 text-xs">
                Install MetaMask or Fluent, then refresh this page and click Connect Wallet again.
              </p>
            </>
          )}
          {displayError && hasWallets && (
            <>
              <p className="font-medium">Connection failed</p>
              <p className="mt-1">{displayError}</p>
            </>
          )}
          {(showNoWalletHelp || displayError) && (
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              <a href={METAMASK_URL} target="_blank" rel="noreferrer" className="underline">
                Install MetaMask
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
    resetError,
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

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  const openDropdown = useCallback(() => {
    setLocalError(null);
    resetError();
    setDropdownOpen(true);
  }, [resetError]);

  const dismissError = useCallback(() => {
    setLocalError(null);
    resetError();
  }, [resetError]);

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

  useEffect(() => {
    if (!displayError) return;
    const timer = setTimeout(dismissError, 6000);
    return () => clearTimeout(timer);
  }, [displayError, dismissError]);

  const handleConnect = useCallback(
    async (connector: Connector | undefined) => {
      dismissError();
      if (!connector) {
        setNoWalletTried(true);
        setLocalError('No wallet detected. Install MetaMask or Fluent, then refresh.');
        return;
      }
      try {
        await connect(connector);
        closeDropdown();
      } catch {

      }
    },
    [connect, closeDropdown, dismissError]
  );

  const handleSwitchChain = useCallback(async () => {
    dismissError();
    try {
      await switchChain();
    } catch {
      
    }
  }, [switchChain, dismissError]);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [address]);

  const errorToast = displayError || showNoWalletHelp ? (
    <div
      className="flex items-start gap-2 rounded-lg border border-[rgb(var(--color-danger))]/40 bg-[rgb(var(--color-danger))]/10 px-3 py-2 text-left text-[11px] leading-snug text-[rgb(var(--color-danger))] sm:text-xs"
      role="alert"
      style={{ maxWidth: 240 }}
    >
      <span className="flex-1 min-w-0">
        {showNoWalletHelp
          ? <>No wallet found. <a href={METAMASK_URL} target="_blank" rel="noreferrer" className="underline">Get MetaMask</a></>
          : displayError}
      </span>
      <button
        type="button"
        onClick={dismissError}
        className="shrink-0 p-0.5 hover:text-[rgb(var(--color-text))] transition-colors"
        aria-label="Dismiss error"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  ) : null;

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {!isCorrectChain && (
          <Badge variant="warning" className="shrink-0 text-[10px] sm:text-xs">
            Wrong network
          </Badge>
        )}
        <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]/80 py-1 pl-2 pr-1">
          <button
            type="button"
            onClick={handleCopyAddress}
            className="max-w-[90px] truncate font-mono text-[10px] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors sm:max-w-[140px] sm:text-xs"
            title={address}
            aria-label={`Copy address ${address}`}
          >
            {formatAddress(address)}
          </button>
          <span
            className={clsx(
              'text-[10px] sm:text-xs px-1 py-0.5 rounded transition-opacity',
              copySuccess ? 'text-[rgb(var(--color-success))]' : 'text-[rgb(var(--color-text-muted))]'
            )}
            aria-live="polite"
          >
            {copySuccess ? '✓' : ''}
          </span>
        </div>
        {!isCorrectChain && (
          <Button
            variant="primary"
            size="sm"
            loading={isSwitchingChain}
            disabled={isSwitchingChain}
            onClick={handleSwitchChain}
            aria-label={`Switch to ${supportedChain.name}`}
            className="shrink-0 text-[10px] sm:text-sm"
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
          className="shrink-0 text-[10px] sm:text-sm"
        >
          <span className="hidden sm:inline">Disconnect</span>
          <span className="sm:hidden">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
        </Button>
        {errorToast}
      </div>
    );
  }

  const list = connectors.length > 0 ? [...connectors] : [];
  const hasWallets = list.length > 0;

  return (
    <div className="relative flex flex-col items-end gap-2 min-w-0" ref={dropdownRef}>
      <Button
        variant="primary"
        size="sm"
        onClick={hasWallets ? openDropdown : () => handleConnect(undefined)}
        disabled={isConnecting}
        loading={isConnecting}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
        aria-label={hasWallets ? 'Choose wallet to connect' : 'Connect wallet'}
        className="text-xs sm:text-sm"
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </Button>

      {dropdownOpen && hasWallets && (
        <div
          className="absolute right-0 top-full z-[200] mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-2 shadow-lg"
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
        <p className="text-left text-[11px] text-[rgb(var(--color-text-muted))] sm:text-xs" style={{ maxWidth: 220 }}>
          Check your wallet to approve.
        </p>
      )}

      {!dropdownOpen && errorToast}
    </div>
  );
}

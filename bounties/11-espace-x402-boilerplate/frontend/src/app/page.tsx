'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { NETWORKS, type Token } from '@/lib/networks';
import { payAndFetch, formatAmount } from '@/lib/x402-client';
import {
  connectWallet,
  getAddress,
  shortAddress,
  getWalletOptions,
  type WalletType,
  type WalletOption,
} from '@/lib/wallet';

const SELLER_URL = process.env.NEXT_PUBLIC_SELLER_URL || 'http://localhost:3852';

type Mode = 'server' | 'wallet';
type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface Step {
  id: string;
  icon: string;
  title: string;
  status: StepStatus;
  detail: string;
  badge?: { text: string; type: 'http-402' | 'http-200' };
  visible: boolean;
}

const STEP_DEFS = [
  { id: 'request', icon: '\u{1F310}', title: 'Request API' },
  { id: 'parse', icon: '\u{1F4B0}', title: 'Parse payment envelope' },
  { id: 'pay', icon: '\u270D\uFE0F', title: 'Execute payment' },
  { id: 'settle', icon: '\u{1F680}', title: 'Settle & get response' },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Home() {
  const [network, setNetwork] = useState('testnet');
  const [token, setToken] = useState('CFX');
  const [mode, setMode] = useState<Mode>('server');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Wallet state
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [walletName, setWalletName] = useState('');

  // Timeline state
  const [steps, setSteps] = useState<Step[]>([]);

  // Answer state
  const [answer, setAnswer] = useState('');
  const [answerMeta, setAnswerMeta] = useState('');
  const [answerVisible, setAnswerVisible] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [typing, setTyping] = useState(false);

  const net = NETWORKS[network];
  const tokens = net.tokens;
  const selectedToken = tokens.find((t) => t.symbol === token) || tokens[0];

  const resetTimeline = useCallback(() => {
    setSteps(
      STEP_DEFS.map((d) => ({
        ...d,
        status: 'pending' as StepStatus,
        detail: '',
        visible: false,
      })),
    );
    setAnswer('');
    setAnswerMeta('');
    setAnswerVisible(false);
    setTxHash('');
    setError('');
    setTyping(false);
  }, []);

  const updateStep = useCallback(
    (
      id: string,
      updates: Partial<Pick<Step, 'status' | 'detail' | 'badge' | 'visible'>>,
    ) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
    },
    [],
  );

  // Typewriter effect
  const typewrite = useCallback(async (text: string) => {
    setTyping(true);
    const words = text.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      current += (i > 0 ? ' ' : '') + words[i];
      setAnswer(current);
      await sleep(30 + Math.random() * 30);
    }
    setTyping(false);
  }, []);

  const handleNetworkChange = async (n: string) => {
    setNetwork(n);
    setToken('CFX');
    resetTimeline();

    // Switch wallet chain if already connected
    if (address && providerRef.current) {
      const targetNet = NETWORKS[n];
      const chainIdHex = `0x${targetNet.chainId.toString(16)}`;
      try {
        await providerRef.current.send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);
      } catch (err: any) {
        if (err.code === 4902) {
          await providerRef.current.send('wallet_addEthereumChain', [{
            chainId: chainIdHex,
            chainName: targetNet.name,
            nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
            rpcUrls: [targetNet.rpcUrl],
            blockExplorerUrls: [targetNet.explorerUrl],
          }]);
        }
      }
    }
  };

  const handleConnect = () => {
    setWalletOptions(getWalletOptions());
    setShowWalletModal(true);
    setError('');
  };

  const handleWalletSelect = async (wt: WalletType) => {
    setShowWalletModal(false);
    setConnecting(true);
    const option = walletOptions.find((w) => w.type === wt);
    try {
      const provider = await connectWallet(wt, net);
      providerRef.current = provider;
      const addr = await getAddress(provider);
      setAddress(addr);
      setWalletName(option?.name || wt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    providerRef.current = null;
    setWalletName('');
  };

  // Server Demo flow
  const handleServerDemo = async () => {
    setLoading(true);
    resetTimeline();
    await sleep(50); // Let state settle

    const q = question || 'What is Conflux Network?';

    try {
      // Step 1: Request
      updateStep('request', { visible: true, status: 'active', detail: `GET ${SELLER_URL}/ai?q=${q.substring(0, 30)}...` });
      await sleep(600);

      const res = await fetch(
        `${SELLER_URL}/ai?q=${encodeURIComponent(q)}&token=${token}&network=${network}&demo=1`,
      );

      if (res.status === 402) {
        const paymentHeader =
          res.headers.get('PAYMENT-REQUIRED') ||
          res.headers.get('payment-required');

        updateStep('request', {
          status: 'done',
          detail: 'HTTP 402 — Payment Required',
          badge: { text: '402', type: 'http-402' },
        });
        await sleep(400);

        // Step 2: Parse envelope
        updateStep('parse', { visible: true, status: 'active', detail: 'Decoding PAYMENT-REQUIRED header...' });
        await sleep(500);

        if (paymentHeader) {
          const envelope = JSON.parse(atob(paymentHeader));
          const req = envelope.accepts[0];
          const amountStr = formatAmount(req.amount, req.extra.decimals);

          updateStep('parse', {
            status: 'done',
            detail: `Token: ${req.extra.symbol} (${req.extra.paymentMethod})\nAmount: ${amountStr} ${req.extra.symbol}\nPay to: ${req.payTo.substring(0, 10)}...${req.payTo.substring(38)}`,
          });
        } else {
          updateStep('parse', { status: 'done', detail: 'No envelope found' });
        }
        await sleep(400);

        // Step 3: Pay failed (402 means demo payment not available for this token/network)
        const isTestnet = network === 'testnet';
        updateStep('pay', {
          visible: true,
          status: 'error',
          detail: isTestnet
            ? 'Server demo payment failed.\nCheck server logs or token balance.'
            : `Server demo auto-pays on testnet only.\nFor mainnet — use "Pay with Wallet" mode.`,
        });
        await sleep(300);

        // Step 4: Skip
        updateStep('settle', { visible: true, status: 'error', detail: 'Payment required to proceed' });

        setError(
          isTestnet
            ? 'Server demo payment failed — check server logs'
            : `For mainnet payments — switch to "Pay with Wallet" mode`,
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        updateStep('request', { status: 'error', detail: data.error || `HTTP ${res.status}` });
        setError(data.error || data.message || `HTTP ${res.status}`);
        return;
      }

      // Direct success (server paid via demo mode)
      const data = await res.json();
      const payment = data.data?.payment;

      updateStep('request', {
        status: 'done',
        detail: 'HTTP 200 — Server paid automatically',
        badge: { text: '200', type: 'http-200' },
      });
      await sleep(400);

      updateStep('parse', { visible: true, status: 'active', detail: 'Parsing payment info...' });
      await sleep(400);
      updateStep('parse', {
        status: 'done',
        detail: payment
          ? `Token: ${payment.token} (native)\nAmount: ${payment.amount} ${payment.token}\nPayer: ${payment.payer?.substring(0, 10)}...${payment.payer?.substring(38)}`
          : 'Payment completed by server',
      });
      await sleep(400);

      updateStep('pay', { visible: true, status: 'active', detail: 'Server agent paying on testnet...' });
      await sleep(500);
      updateStep('pay', {
        status: 'done',
        detail: payment?.tx_hash
          ? `TX: ${payment.tx_hash.substring(0, 18)}...`
          : 'Server demo payment completed',
      });
      await sleep(400);

      updateStep('settle', { visible: true, status: 'active', detail: 'Settling on-chain...' });
      await sleep(500);
      updateStep('settle', {
        status: 'done',
        detail: 'Paid & settled successfully',
        badge: { text: '200', type: 'http-200' },
      });
      await sleep(300);

      // Show answer
      setAnswerMeta(
        `${data.data?.tokens_used || 0} tokens \u00B7 ${data.data?.model || 'claude'}`,
      );
      if (payment?.tx_hash) {
        setTxHash(payment.tx_hash);
      }
      setAnswerVisible(true);
      await sleep(200);
      await typewrite(data.data?.answer || 'No response received.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Wallet flow
  const handleWalletPay = async () => {
    if (!providerRef.current) {
      setError('Connect your wallet first');
      return;
    }

    setLoading(true);
    resetTimeline();
    await sleep(50);

    const q = question || 'What is Conflux Network?';

    try {
      // Ensure wallet is on the correct chain before paying
      const chainIdHex = `0x${net.chainId.toString(16)}`;
      try {
        await providerRef.current.send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await providerRef.current.send('wallet_addEthereumChain', [{
            chainId: chainIdHex,
            chainName: net.name,
            nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
            rpcUrls: [net.rpcUrl],
            blockExplorerUrls: [net.explorerUrl],
          }]);
        } else {
          throw switchErr;
        }
      }

      const signer = await providerRef.current.getSigner();
      const url = `${SELLER_URL}/ai?q=${encodeURIComponent(q)}&token=${token}&network=${network}`;

      // Step 1
      updateStep('request', { visible: true, status: 'active', detail: `GET ${url.substring(0, 50)}...` });
      await sleep(400);

      // Use payAndFetch with step updates
      const onStatus = (msg: string) => {
        if (msg.includes('Payment required')) {
          updateStep('request', {
            status: 'done',
            detail: 'HTTP 402 — Payment Required',
            badge: { text: '402', type: 'http-402' },
          });
          updateStep('parse', { visible: true, status: 'active', detail: 'Parsing payment envelope...' });
        } else if (
          msg.includes('EIP-3009') ||
          msg.includes('ERC-20') ||
          msg.includes('Native')
        ) {
          updateStep('parse', { status: 'done', detail: msg });
          updateStep('pay', { visible: true, status: 'active', detail: msg });
        } else if (msg.includes('Approving')) {
          updateStep('pay', { status: 'active', detail: 'Approving token spend...' });
        } else if (msg.includes('Approved')) {
          updateStep('pay', { detail: 'Token approved. Preparing payment...' });
        } else if (msg.includes('Sending')) {
          updateStep('pay', { status: 'active', detail: msg });
        } else if (msg.includes('paid request')) {
          updateStep('pay', { status: 'done', detail: 'Payment signed' });
          updateStep('settle', { visible: true, status: 'active', detail: 'Settling on-chain...' });
        }
      };

      const payResult = await payAndFetch(url, signer, onStatus);

      if (!payResult.success) {
        updateStep('settle', {
          visible: true,
          status: 'error',
          detail: payResult.error || 'Payment failed',
        });
        setError(payResult.error || 'Payment failed');
        return;
      }

      updateStep('settle', {
        status: 'done',
        detail: `Paid & settled successfully`,
        badge: { text: '200', type: 'http-200' },
      });

      await sleep(300);

      // Show answer
      if (payResult.data) {
        setAnswerMeta(
          `${payResult.data.tokens_used || 0} tokens \u00B7 ${payResult.data.model || 'claude'}`,
        );
        if (payResult.txHash || payResult.data?.payment?.tx_hash) {
          setTxHash(payResult.txHash || payResult.data.payment.tx_hash);
        }
        setAnswerVisible(true);
        await sleep(200);
        await typewrite(
          payResult.data.answer || 'No response received.',
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">x402 Protocol &middot; Fullstack Demo</div>
        <h1>Multi-Token Payment Demo</h1>
        <p>
          HTTP 402 payments on Conflux eSpace. 10 tokens, 3 payment methods,
          <br />
          Testnet + Mainnet. Pick a token and try it.
        </p>
      </div>

      <div className="container-main">
        {/* Network Tabs */}
        <div className="network-tabs">
          {[
            { id: 'testnet', label: 'Testnet', chainId: 71 },
            { id: 'mainnet', label: 'Mainnet', chainId: 1030 },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`network-tab ${network === tab.id ? 'active' : ''}`}
              onClick={() => handleNetworkChange(tab.id)}
            >
              {tab.label}
              <span className="chain-id">({tab.chainId})</span>
            </button>
          ))}
        </div>

        {/* Token Grid */}
        <div className="token-grid">
          {tokens.map((t) => (
            <button
              key={t.symbol}
              className={`token-card ${token === t.symbol ? 'active' : ''}`}
              onClick={() => {
                setToken(t.symbol);
                resetTimeline();
              }}
            >
              <div className="token-symbol">{t.symbol}</div>
              <div className="token-name">{t.name}</div>
              <span className={`token-method method-${t.paymentMethod}`}>
                {t.paymentMethod === 'eip3009'
                  ? '3009'
                  : t.paymentMethod === 'erc20'
                    ? 'ERC20'
                    : 'CFX'}
              </span>
            </button>
          ))}
        </div>

        {/* Mode Tabs */}
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'server' ? 'active' : ''}`}
            onClick={() => setMode('server')}
          >
            Server Demo
          </button>
          <button
            className={`mode-tab ${mode === 'wallet' ? 'active' : ''}`}
            onClick={() => setMode('wallet')}
          >
            Pay with Wallet
          </button>
        </div>

        {/* Wallet Bar */}
        {mode === 'wallet' && (
          <div className="wallet-bar">
            {address ? (
              <>
                <span className="wallet-address">
                  {walletName && <>{walletName} &middot; </>}
                  {shortAddress(address)}
                </span>
                <button className="btn-disconnect" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </>
            ) : (
              <button
                className="btn-wallet"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <span className="spinner" /> Connecting...
                  </>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          <div className="input-row">
            <input
              type="text"
              placeholder="Ask something about Conflux..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  mode === 'server' ? handleServerDemo() : handleWalletPay();
                }
              }}
              maxLength={500}
            />
            <button
              className="btn-ask"
              onClick={mode === 'server' ? handleServerDemo : handleWalletPay}
              disabled={loading || (mode === 'wallet' && !address)}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Processing...
                </>
              ) : mode === 'server' ? (
                'Ask AI'
              ) : (
                `Pay & Ask (${token})`
              )}
            </button>
          </div>
          <div className="price-tag">
            <span className="dot" />
            <span>
              {mode === 'server' ? 'Server demo' : 'Wallet payment'} &middot;{' '}
              {net.name} &middot; {selectedToken.symbol} (
              {selectedToken.paymentMethod})
            </span>
          </div>
        </div>

        {/* Error */}
        {error && <div className="error-msg">{error}</div>}

        {/* Timeline */}
        {steps.length > 0 && (
          <div className="timeline">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`step ${step.visible ? 'visible' : ''}`}
              >
                <div className={`step-dot ${step.status}`}>{step.icon}</div>
                <div className="step-card">
                  <div className="step-title">
                    {step.title}
                    {step.badge && (
                      <span className={`http-badge ${step.badge.type}`}>
                        {step.badge.text}
                      </span>
                    )}
                  </div>
                  {step.detail && (
                    <div className="step-detail">
                      {step.detail.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answer Card */}
        <div className={`answer-card ${answerVisible ? 'visible' : ''}`}>
          <div className="answer-header">
            <span className="answer-label">&#x2728; AI Response</span>
            <span className="answer-meta">{answerMeta}</span>
          </div>
          <div className="answer-text">
            {answer}
            {typing && <span className="cursor" />}
          </div>
          {txHash && (
            <a
              className="tx-link"
              href={`${net.explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              &#x1F517; View on ConfluxScan
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="x402-footer">
          <Link href="/pay">API</Link> &middot;{' '}
          <Link href="/history">History</Link> &middot;{' '}
          <Link href="/admin">Admin</Link> &middot;{' '}
          <a
            href="https://github.com/confluxarena/x402-fullstack"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{' '}
          &middot;{' '}
          <a
            href="https://www.x402.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            x402 Protocol
          </a>
        </div>
      </div>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div
          className="wallet-modal-overlay"
          onClick={() => setShowWalletModal(false)}
        >
          <div
            className="wallet-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-modal-header">
              <span className="wallet-modal-title">Connect Wallet</span>
              <button
                className="wallet-modal-close"
                onClick={() => setShowWalletModal(false)}
              >
                &#x2715;
              </button>
            </div>
            {walletOptions.map((w) => (
              <button
                key={w.type}
                className={`wallet-option ${!w.installed ? 'disabled' : ''}`}
                onClick={() => {
                  if (w.installed) {
                    handleWalletSelect(w.type);
                  } else {
                    window.open(w.downloadUrl, '_blank');
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="wallet-option-icon"
                  src={w.icon}
                  alt={w.name}
                />
                <div className="wallet-option-info">
                  <div className="wallet-option-name">{w.name}</div>
                  <div className="wallet-option-desc">{w.description}</div>
                </div>
                <span
                  className={`wallet-option-badge ${w.installed ? 'installed' : 'not-installed'}`}
                >
                  {w.installed ? 'Detected' : 'Install'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

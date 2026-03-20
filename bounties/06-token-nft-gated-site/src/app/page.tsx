'use client'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('conflux_account')
    if (stored) setAccount(stored)
  }, [])

  const connect = async () => {
    const ethereum = (window as any).ethereum
    if (!ethereum) { alert('Please install MetaMask'); return }
    const provider = new ethers.BrowserProvider(ethereum)
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x406' }] })
    } catch { /* already on chain or rejected */ }
    const signer = await provider.getSigner()
    const addr = await signer.getAddress()
    localStorage.setItem('conflux_account', addr)
    setAccount(addr)
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <h2 className="text-4xl font-bold mb-4">Token & NFT Gated Content</h2>
      <p className="text-slate-400 mb-8">Access exclusive content based on your Conflux eSpace token holdings</p>
      {account ? (
        <div className="bg-slate-800 rounded-lg p-6">
          <p className="text-sm text-slate-400">Connected</p>
          <p className="text-cyan-400 font-mono">{account}</p>
          <a href="/protected" className="inline-block mt-4 bg-cyan-600 px-6 py-2 rounded hover:bg-cyan-500">Access Protected Content →</a>
        </div>
      ) : (
        <button onClick={connect} className="bg-cyan-600 px-8 py-3 rounded-lg text-lg hover:bg-cyan-500">Connect Wallet</button>
      )}
    </div>
  )
}

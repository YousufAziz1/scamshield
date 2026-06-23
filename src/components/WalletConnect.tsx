import { motion } from 'framer-motion'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { WalletState } from '@/hooks/useWallet'

interface WalletConnectProps {
  wallet: WalletState
  onConnect: () => void
  onDisconnect: () => void
}

export function WalletConnect({ wallet, onConnect, onDisconnect }: WalletConnectProps) {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!wallet.address) return
    try {
      await navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  if (wallet.address) {
    const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    return (
      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-mono border transition-all duration-300"
          style={{
            background: 'rgba(15, 23, 42, 0.45)',
            borderColor: 'var(--border-accent, rgba(255,255,255,0.05))',
            color: 'var(--text-primary)',
          }}
          whileHover={{ borderColor: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }}
        >
          <span className="w-2 h-2 rounded-full pulse-dot-green flex-shrink-0" style={{ background: 'var(--accent-green)' }} />
          <span className="font-semibold">{shortAddress}</span>
          <button
            onClick={copyAddress}
            className="p-1 hover:text-slate-200 transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            title="Copy address"
          >
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-green)' }} /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </motion.div>
        <button
          onClick={onDisconnect}
          className="p-2.5 rounded-full transition-all duration-300 hover:bg-red-950/20 cursor-pointer"
          style={{ color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.15)' }}
          title="Disconnect wallet"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      id="connect-wallet-btn"
      onClick={onConnect}
      disabled={wallet.isConnecting}
      className="btn-cyber px-5 py-2.5 text-xs flex items-center gap-2 font-bold transition-all duration-200"
      style={{
        background: 'transparent',
        border: '1px solid var(--accent-cyan)',
        color: 'var(--accent-cyan)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,255,204,0.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
    >
      <Wallet className="w-4 h-4" />
      {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

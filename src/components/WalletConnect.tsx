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
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-md transition-all duration-300"
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            borderColor: 'rgba(0, 242, 254, 0.25)',
            color: '#F8FAFC',
          }}
          whileHover={{ borderColor: 'var(--accent-cyan)', boxShadow: '0 0 16px rgba(0, 242, 254, 0.25)' }}
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <span className="font-medium text-slate-200">{shortAddress}</span>
          <button
            onClick={copyAddress}
            className="p-1 hover:text-cyan-300 text-slate-400 transition-colors cursor-pointer"
            title="Copy address"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </motion.div>

        <button
          onClick={onDisconnect}
          className="p-2 rounded-full transition-all duration-300 hover:bg-red-950/30 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 cursor-pointer"
          title="Disconnect wallet"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      id="connect-wallet-btn"
      onClick={onConnect}
      disabled={wallet.isConnecting}
      className="btn-primary-glow text-xs py-2 px-4.5 rounded-full flex items-center gap-2 font-display tracking-wider font-bold transition-all duration-200"
    >
      <Wallet className="w-4 h-4 text-black" />
      <span>{wallet.isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}</span>
    </button>
  )
}

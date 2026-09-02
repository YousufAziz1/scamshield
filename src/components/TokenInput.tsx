import React, { useState } from 'react'
import { Search, Zap, Clipboard, X, AlertTriangle, RotateCcw, Cpu } from 'lucide-react'

interface TokenInputProps {
  onScan: (address: string, chainId: string) => void
  status: string
  onReset: () => void
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', badge: 'ETH', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30' },
  { id: 'bsc',      label: 'BNB Chain', badge: 'BSC', color: 'text-amber-400 bg-amber-950/40 border-amber-500/30' },
  { id: 'polygon',  label: 'Polygon',  badge: 'POL', color: 'text-purple-400 bg-purple-950/40 border-purple-500/30' },
  { id: 'arbitrum', label: 'Arbitrum', badge: 'ARB', color: 'text-blue-400 bg-blue-950/40 border-blue-500/30' },
  { id: 'base',     label: 'Base',     badge: 'BASE', color: 'text-sky-400 bg-sky-950/40 border-sky-500/30' },
  { id: 'solana',   label: 'Solana',   badge: 'SOL', color: 'text-violet-400 bg-violet-950/40 border-violet-500/30' },
]

const QUICK_TARGETS = [
  { name: 'USDC',      addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'Honeypot',  addr: '0x3207eeBbeA76757b447475f4B95B309A7e5a0fE8', chainId: 'bsc',      chain: 'BSC', safe: false },
  { name: 'Rally NFT', addr: '0x5510cd555b0ae386b420421a7ad98c6785499983', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'WBTC',      addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'UNI',       addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'SafeMoon',  addr: '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3', chainId: 'bsc',      chain: 'BSC', safe: false },
]

export function TokenInput({ onScan, status, onReset }: TokenInputProps) {
  const [tokenAddress, setTokenAddress] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [validationError, setValidationError] = useState('')

  const busy = status !== 'idle' && status !== 'accepted' && status !== 'error'
  const isDone = status === 'accepted' || status === 'error'

  function validateAddress(addr: string, chain: string): boolean {
    const clean = addr.trim()
    if (!clean) {
      setValidationError('Please enter a contract address')
      return false
    }
    if (chain === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
        setValidationError('Invalid Solana base58 token mint address')
        return false
      }
    } else {
      if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) {
        setValidationError('Invalid EVM address: must be 0x followed by 40 hex characters')
        return false
      }
    }
    setValidationError('')
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const clean = tokenAddress.trim()
    if (!validateAddress(clean, selectedChain)) return
    onScan(clean, selectedChain)
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setTokenAddress(text.trim())
        setValidationError('')
      }
    } catch {
      // ignore
    }
  }

  function selectQuickTarget(addr: string, chainId: string) {
    if (busy) return
    setTokenAddress(addr)
    setSelectedChain(chainId)
    setValidationError('')
  }

  return (
    <div className="card-void p-5 sm:p-6 flex flex-col gap-5">
      {/* Console Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00FFC2]/10 border border-[#00FFC2]/30 flex items-center justify-center shadow-[0_0_16px_rgba(0,255,194,0.15)]">
            <Cpu className="w-4 h-4 text-[#00FFC2]" />
          </div>
          <div>
            <h2 className="font-display font-black text-sm uppercase tracking-wider text-white">
              Contract Intelligence
            </h2>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              Multi-Agent Bytecode Analyzer
            </div>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400 uppercase">
          Config
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Network selector pills */}
        <div>
          <label className="font-mono text-[10px] font-bold tracking-wider uppercase text-slate-400 block mb-2">
            Target Blockchain Network
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CHAINS.map(c => {
              const active = selectedChain === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChain(c.id)}
                  disabled={busy}
                  className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all text-left flex items-center justify-between border cursor-pointer ${
                    active
                      ? 'bg-[#00FFC2]/15 border-[#00FFC2] text-[#00FFC2] shadow-[0_0_14px_rgba(0,255,194,0.25)]'
                      : 'bg-black/30 border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c.color}`}>{c.badge}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contract Address Input Box */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Contract Address
            </label>
            <button
              type="button"
              onClick={handlePaste}
              disabled={busy}
              className="text-[10px] font-mono text-[#00FFC2] hover:text-[#00D1FF] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Clipboard className="w-3 h-3" />
              Paste
            </button>
          </div>

          <div className="relative rounded-xl border border-white/[0.08] bg-black/50 focus-within:border-[#00FFC2]/60 focus-within:shadow-[0_0_20px_rgba(0,255,194,0.15)] transition-all">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="token-address-input"
              type="text"
              value={tokenAddress}
              onChange={e => { setTokenAddress(e.target.value); setValidationError('') }}
              disabled={busy}
              placeholder={selectedChain === 'solana' ? 'Solana mint address...' : '0x...'}
              className="w-full bg-transparent pl-10 pr-10 py-3 text-xs font-mono text-white placeholder-slate-600 outline-none"
            />
            {tokenAddress && (
              <button
                type="button"
                onClick={() => setTokenAddress('')}
                disabled={busy}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {validationError && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Powerful Neon Pulse CTA Button */}
        {!isDone ? (
          <button
            id="scan-submit-btn"
            type="submit"
            disabled={busy}
            className="w-full btn-neon-pulse cursor-pointer mt-1"
          >
            {busy ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                <span>CONSENSUS EXECUTING...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current stroke-1" />
                <span>SCAN CONTRACT</span>
              </>
            )}
          </button>
        ) : (
          <button
            id="reset-scan-btn"
            type="button"
            onClick={() => {
              setTokenAddress('')
              setValidationError('')
              onReset()
            }}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET SCANNER</span>
          </button>
        )}
      </form>

      {/* Quick Sample Contracts */}
      <div className="pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">
            Quick Sample Contracts
          </span>
          <span className="text-[9px] font-mono text-slate-500">1-Click Test</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_TARGETS.map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectQuickTarget(t.addr, t.chainId)}
              disabled={busy}
              className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 group-hover:text-[#00FFC2]">
                  {t.name}
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  t.safe ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' : 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                }`}>
                  {t.chain}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

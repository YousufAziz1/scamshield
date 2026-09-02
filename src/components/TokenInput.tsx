import { useState } from 'react'
import { Search, AlertTriangle, RotateCcw, Clipboard, X, Sparkles } from 'lucide-react'
import type { ScanStatus } from '@/types'

interface TokenInputProps {
  onScan: (tokenAddress: string, chainId: string) => void
  status: ScanStatus
  onReset: () => void
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', badge: 'ETH', color: 'text-blue-400 border-blue-500/30 bg-blue-950/20' },
  { id: 'bsc',      label: 'BNB Chain', badge: 'BSC', color: 'text-amber-400 border-amber-500/30 bg-amber-950/20' },
  { id: 'polygon',  label: 'Polygon',  badge: 'POL', color: 'text-purple-400 border-purple-500/30 bg-purple-950/20' },
  { id: 'arbitrum', label: 'Arbitrum', badge: 'ARB', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20' },
  { id: 'base',     label: 'Base',     badge: 'BASE', color: 'text-sky-400 border-sky-500/30 bg-sky-950/20' },
  { id: 'solana',   label: 'Solana',   badge: 'SOL', color: 'text-violet-400 border-violet-500/30 bg-violet-950/20' },
]

const QUICK_TARGETS = [
  { name: 'USDC', chain: 'ETH', chainId: 'ethereum', safe: true, addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { name: 'Honeypot', chain: 'BSC', chainId: 'bsc', safe: false, addr: '0x4f128e6dbd1283c799a4e21a2c91a329d48b1111' },
  { name: 'Rally NFT', chain: 'ETH', chainId: 'ethereum', safe: true, addr: '0x5510cd555b0ae386b420421a7ad98c6785499983' },
  { name: 'WBTC', chain: 'ETH', chainId: 'ethereum', safe: true, addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  { name: 'UNI', chain: 'ETH', chainId: 'ethereum', safe: true, addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
  { name: 'SafeMoon', chain: 'BSC', chainId: 'bsc', safe: false, addr: '0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3' },
]

const SCANNING: ScanStatus[] = ['submitting', 'pending', 'proposing', 'committing', 'revealing', 'accepted']

export function TokenInput({ onScan, status, onReset }: TokenInputProps) {
  const [tokenAddress, setTokenAddress] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [validationError, setValidationError] = useState('')

  const busy   = SCANNING.includes(status)
  const isDone = status === 'finalized' || status === 'error'

  function validate(addr: string): string {
    if (!addr.trim()) return 'Please enter a contract address'
    if (selectedChain === 'solana') {
      if (addr.length < 32 || addr.length > 44) return 'Invalid Solana mint address length'
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'Invalid EVM address (must be 42 characters starting with 0x)'
    }
    return ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(tokenAddress)
    if (err) { setValidationError(err); return }
    setValidationError('')
    onScan(tokenAddress.trim(), selectedChain)
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setTokenAddress(text.trim())
        setValidationError('')
      }
    } catch {
      // clipboard permission denied
    }
  }

  function selectQuickTarget(addr: string, chainId: string) {
    if (busy) return
    setTokenAddress(addr)
    setSelectedChain(chainId)
    setValidationError('')
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-5">
      {/* Console Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Contract Intelligence Scanner
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Multi-Agent AI
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-1">
          Evaluate smart contracts, liquidity pools, and bytecode across GenLayer validators.
        </p>
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
                  className={`px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all text-left flex items-center justify-between border cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.18)]'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-900/70'
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.color}`}>{c.badge}</span>
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
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Clipboard className="w-3 h-3" />
              Paste
            </button>
          </div>

          <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(0,242,254,0.12)] transition-all">
            <input
              id="token-address-input"
              type="text"
              value={tokenAddress}
              onChange={e => { setTokenAddress(e.target.value); setValidationError('') }}
              disabled={busy}
              placeholder={selectedChain === 'solana' ? 'Solana mint address...' : '0x...'}
              className="w-full bg-transparent px-3.5 py-3 text-xs font-mono text-white placeholder-slate-600 outline-none pr-16"
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

        {/* Primary CTA Button */}
        {!isDone ? (
          <button
            id="scan-submit-btn"
            type="submit"
            disabled={busy}
            className="btn-primary-glow w-full py-3 text-xs tracking-widest font-display uppercase flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>CONSENSUS IN PROGRESS...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>SCAN CONTRACT</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET SCANNER</span>
          </button>
        )}
      </form>

      {/* Quick Target Presets */}
      <div className="pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500">
            Quick Sample Contracts
          </span>
          <span className="text-[9px] font-mono text-slate-600">1-Click Test</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_TARGETS.map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectQuickTarget(t.addr, t.chainId)}
              disabled={busy}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300">
                  {t.name}
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  t.safe ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40' : 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
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

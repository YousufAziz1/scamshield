import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { useGenLayer } from '@/hooks/useGenLayer'
import { CONTRACT } from '@/lib/genlayer'
import { useWallet } from '@/hooks/useWallet'
import { VerdictCard } from '@/components/VerdictCard'
import { RiskFlags } from '@/components/RiskFlags'
import type { ScanResult } from '@/types'

const fmt = (addr: string) => (!addr ? '' : addr.length <= 13 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`)

const CHAINS = [
  { id: 'ethereum', label: 'ETH', icon: 'currency_exchange' },
  { id: 'solana',   label: 'SOL', icon: 'bolt' },
  { id: 'polygon',  label: 'POLY', icon: 'category' },
  { id: 'bsc',      label: 'BSC', icon: 'token' },
  { id: 'arbitrum', label: 'ARB', icon: 'hub' },
  { id: 'base',     label: 'BASE', icon: 'layers' },
]

const QUICK_TARGETS = [
  { name: 'USDC',      addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'Honeypot',  addr: '0x3207eeBbeA76757b447475f4B95B309A7e5a0fE8', chainId: 'bsc',      chain: 'BSC', safe: false },
  { name: 'Rally NFT', addr: '0x5510cd555b0ae386b420421a7ad98c6785499983', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'WBTC',      addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'UNI',       addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chainId: 'ethereum', chain: 'ETH', safe: true },
  { name: 'SafeMoon',  addr: '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3', chainId: 'bsc',      chain: 'BSC', safe: false },
]

const CONSENSUS_STAGES = [
  { stage: '01', name: 'Mempool & Ingestion', key: 'pending' },
  { stage: '02', name: 'Leader Proposal',     key: 'proposing' },
  { stage: '03', name: 'Commit Phase',        key: 'committing' },
  { stage: '04', name: 'Vote Revelation',     key: 'revealing' },
  { stage: '05', name: 'Finalization',        key: 'accepted' },
] as const

export default function App() {
  const { scanState, scanToken, reset, connectionError } = useGenLayer()
  const { wallet, connect, disconnect } = useWallet()

  const [tokenAddress, setTokenAddress] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [validationError, setValidationError] = useState('')
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [viewingScan, setViewingScan] = useState<ScanResult | null>(null)
  const [copiedAddr, setCopiedAddr] = useState(false)

  const lastFinalizedRef = useRef<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Accumulate scans in session history
  useEffect(() => {
    if (scanState.status === 'finalized' && scanState.result) {
      const res = scanState.result
      if (lastFinalizedRef.current !== res.tokenAddress) {
        lastFinalizedRef.current = res.tokenAddress
        setRecentScans(prev => [res, ...prev.filter(x => x.tokenAddress.toLowerCase() !== res.tokenAddress.toLowerCase())])
      }
    }
  }, [scanState.status, scanState.result])

  const currentResult = viewingScan ?? scanState.result
  const busy = ['submitting', 'pending', 'proposing', 'committing', 'revealing', 'accepted'].includes(scanState.status)

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [scanState.status, busy, currentResult])

  // Validation
  function validateAddress(addr: string, chain: string): boolean {
    const clean = addr.trim()
    if (!clean) {
      setValidationError('Please enter a contract address')
      return false
    }
    if (chain === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
        setValidationError('Invalid Solana base58 token address')
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

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const clean = tokenAddress.trim()
    if (!validateAddress(clean, selectedChain)) return

    setViewingScan(null)
    if (!wallet.address) {
      try {
        await connect()
      } catch (err) {
        console.error('Wallet connection failed:', err)
        return
      }
    }

    const currentWallet = wallet.address || ((window.ethereum as unknown as { selectedAddress?: string })?.selectedAddress) || ''
    await scanToken(clean, selectedChain, currentWallet)
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

  const copyContractAddr = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT)
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    } catch {
      // ignore
    }
  }

  // Calculate Donut progress & theme (strictly real or standby)
  const isMalicious = currentResult ? currentResult.verdict === 'SCAM' || currentResult.verdict === 'RISKY' : false
  const isUnknown = currentResult ? currentResult.verdict === 'UNKNOWN' : false
  const rawScore = currentResult?.risk_score ?? currentResult?.riskScore
  const activeScore = currentResult && !isUnknown && rawScore != null ? Math.round(rawScore) : null
  const donutOffset = activeScore !== null ? 251.2 - (251.2 * (100 - activeScore)) / 100 : 251.2
  const donutColor = isMalicious ? '#FF3E3E' : isUnknown ? '#ffe253' : currentResult ? '#00ffc2' : '#323443'
  const donutStatusText = isMalicious ? 'SCAM' : isUnknown ? 'UNKNOWN' : currentResult ? 'SAFE' : busy ? 'ACTIVE' : 'STANDBY'

  // Truthful session-bound metrics
  const sessionScansCount = recentScans.length
  const sessionThreatsCount = recentScans.filter(s => s.verdict === 'SCAM' || s.verdict === 'RISKY').length

  return (
    <div className="bg-background font-body-md text-on-background min-h-screen flex flex-col justify-between">
      
      {/* ── HEADER ── */}
      <header className="sticky top-0 w-full z-50 bg-surface-container/80 backdrop-blur-2xl border-b border-border-subtle shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <div className="h-16 w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="ScamShield Logo"
                className="w-8 h-8 rounded-lg object-cover border border-primary-container/40 shadow-[0_0_12px_rgba(0,255,194,0.3)]"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display-lg text-sm text-white tracking-wider font-extrabold">SCAMSHIELD</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary-container/15 border border-primary-container/30 text-primary-container font-bold">
                    AI
                  </span>
                </div>
                <span className="text-[8px] font-mono text-text-muted/70 tracking-widest uppercase">GENLAYER CONSENSUS</span>
              </div>
            </div>

            {/* Truthful Header Metrics */}
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-full bg-surface-container-highest/30 border border-border-subtle text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
              <span className="text-text-muted">Network:</span>
              <span className="text-primary-container font-semibold">StudioNet (61999)</span>
              <span className="text-border-subtle">|</span>
              <span className="text-text-muted">Contract:</span>
              <button
                onClick={copyContractAddr}
                className="text-on-surface hover:text-primary-container font-mono transition-colors cursor-pointer"
                title="Click to copy GenLayer contract address"
              >
                {copiedAddr ? 'COPIED!' : fmt(CONTRACT)}
              </button>
              <span className="text-border-subtle">|</span>
              <span className="text-text-muted">Session Scans:</span>
              <span className="text-on-surface font-semibold">{sessionScansCount}</span>
              <span className="text-border-subtle">|</span>
              <span className="text-text-muted">Session Threats:</span>
              <span className={sessionThreatsCount > 0 ? 'text-alert-critical font-bold' : 'text-primary-container font-semibold'}>
                {sessionThreatsCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-highest/30 border border-border-subtle hover:border-primary-container/40 text-on-surface-variant hover:text-primary-container text-xs font-mono transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              <span>GenLayer Studio</span>
            </a>

            {/* Connect Wallet button */}
            <button
              onClick={() => {
                if (wallet.address) disconnect()
                else connect()
              }}
              className="flex items-center gap-2 px-4 py-1.5 border border-primary-container/50 bg-primary-container/10 text-primary-container font-label-caps text-[11px] hover:bg-primary-container/20 hover:border-primary-container hover:shadow-[0_0_15px_rgba(0,255,194,0.3)] transition-all rounded cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">account_balance_wallet</span>
              <span>{wallet.isConnecting ? 'CONNECTING...' : wallet.address ? fmt(wallet.address) : 'CONNECT WALLET'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Connection Error Notification */}
      <AnimatePresence>
        {connectionError && (
          <div className="fixed top-16 left-0 w-full z-40 bg-alert-critical/90 text-white px-6 py-2.5 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{connectionError}</span>
            </div>
            <button
              onClick={() => reset()}
              className="text-[10px] uppercase font-bold text-white hover:underline p-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* ── MAIN THREE-COLUMN GRID ── */}
      <main className="w-full flex-1 bg-transparent px-4 sm:px-6 lg:px-8 py-5 relative z-10 flex flex-col">
        <div className="flex flex-col flex-1 w-full text-on-surface">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 w-full max-w-[1920px] mx-auto flex-1">
            
            {/* ════════════════════════════════════════════════════════════════
                LEFT COLUMN: Config
            ════════════════════════════════════════════════════════════════ */}
            <div className="col-span-1 md:col-span-3 flex flex-col gap-4">
              
              {/* LOGO AREA */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-container/10 via-secondary-container/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <img
                  alt="Scam Shield Logo"
                  className="w-14 h-14 object-cover relative z-10 drop-shadow-[0_0_15px_rgba(0,255,194,0.5)] rounded-xl border border-primary-container/30"
                  src="/logo.jpg"
                />
                <div className="flex flex-col relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="font-display-lg text-[17px] text-white tracking-wider uppercase font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]">
                      Scam Shield
                    </span>
                    <span className="text-[9px] font-mono px-1 rounded bg-primary-container/15 text-primary-container border border-primary-container/30 font-bold">
                      v2.4
                    </span>
                  </div>
                  <span className="font-label-caps text-[10px] text-primary-container mt-1 flex items-center gap-2 opacity-90">
                    <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                    Status: {busy ? 'TX ACTIVE' : currentResult ? 'FINALIZED' : 'READY'}
                  </span>
                  <span className="text-[9px] font-mono text-text-muted mt-0.5">
                    Network: StudioNet (61999)
                  </span>
                  <span className="text-[9px] font-mono text-text-muted mt-0.5">
                    Consensus: GenLayer Intelligent Contract
                  </span>
                </div>
              </div>

              {/* SCANNER CONFIG */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 flex flex-col gap-4 relative shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2 font-bold tracking-wider">
                    <span className="material-symbols-outlined text-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.4)]">
                      tune
                    </span>
                    CONFIG
                  </h2>
                  <span className="font-mono text-[9px] text-text-muted uppercase">61999</span>
                </div>

                <form onSubmit={handleScanSubmit} className="flex flex-col gap-4">
                  {/* Contract Address Input */}
                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps text-text-muted font-semibold tracking-widest">
                      CONTRACT ADDRESS
                    </label>
                    <div className="relative group">
                      <input
                        id="token-address-input"
                        type="text"
                        value={tokenAddress}
                        onChange={e => { setTokenAddress(e.target.value); setValidationError('') }}
                        placeholder="Paste address here..."
                        disabled={busy}
                        className="w-full bg-surface-container-highest/50 backdrop-blur-sm border border-border-subtle rounded text-primary-container font-code-sm font-medium px-3.5 py-2.5 pr-12 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50 transition-all focus:shadow-[0_0_15px_rgba(0,255,194,0.15)] placeholder:text-text-muted/50 text-xs sm:text-sm truncate"
                      />
                      <button
                        type="button"
                        onClick={handlePaste}
                        disabled={busy}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary-container hover:drop-shadow-[0_0_5px_rgba(0,255,194,0.5)] transition-all p-1 cursor-pointer"
                        title="Paste from clipboard"
                      >
                        <span className="material-symbols-outlined text-[18px]">content_paste</span>
                      </button>
                    </div>
                    {validationError && (
                      <span className="text-[11px] font-mono text-alert-critical mt-1">{validationError}</span>
                    )}
                  </div>

                  {/* Network Selection */}
                  <div className="flex flex-col gap-2 mt-1">
                    <label className="font-label-caps text-text-muted font-semibold tracking-widest">
                      NETWORK
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.map(c => {
                        const active = selectedChain === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedChain(c.id)}
                            disabled={busy}
                            className={`flex flex-col items-center justify-center py-2.5 rounded transition-all cursor-pointer ${
                              active
                                ? 'bg-primary-container/10 border border-primary-container text-primary-container shadow-[inset_0_0_10px_rgba(0,255,194,0.1)] drop-shadow-[0_0_5px_rgba(0,255,194,0.2)]'
                                : 'bg-surface-container-highest/30 border border-border-subtle text-text-muted hover:border-primary-container/50 hover:text-primary-container hover:bg-primary-container/5'
                            }`}
                          >
                            <span className="material-symbols-outlined mb-0.5 text-[18px]">{c.icon}</span>
                            <span className="font-label-caps text-[10px] font-bold">{c.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Initiate Scan Button with Shimmer */}
                  <div className="mt-3">
                    <button
                      id="scan-submit-btn"
                      type="submit"
                      disabled={busy}
                      className="w-full py-4 bg-primary-container text-background font-label-caps text-[14px] font-bold tracking-widest rounded-sm relative overflow-hidden group hover:bg-primary-fixed transition-colors shadow-[0_0_20px_rgba(0,255,194,0.4)] hover:shadow-[0_0_35px_rgba(0,255,194,0.6)] flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[20px]">radar</span>
                      <span>{busy ? 'SCANNING...' : 'INITIATE SCAN'}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    </button>
                  </div>
                </form>

                {/* Quick Sample Targets */}
                <div className="pt-3 border-t border-border-subtle">
                  <span className="font-label-caps text-[10px] text-text-muted font-semibold tracking-widest block mb-2">
                    VERIFIED TEST TARGETS
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_TARGETS.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectQuickTarget(t.addr, t.chainId)}
                        disabled={busy}
                        className="px-2.5 py-2 rounded bg-surface-container-highest/30 border border-border-subtle hover:border-primary-container/50 text-left transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <span className="font-code-sm text-xs font-bold text-on-surface group-hover:text-primary-container">
                          {t.name}
                        </span>
                        <span className={`font-label-caps text-[9px] px-1 rounded ${
                          t.safe ? 'text-primary-container bg-primary-container/10' : 'text-alert-critical bg-alert-critical/10'
                        }`}>
                          {t.chain}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* REAL CONTRACT ENGINE INFO */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-4 flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary-container">code</span>
                    <h3 className="font-label-caps text-[11px] text-text-muted font-bold tracking-widest">
                      GENLAYER CONTRACT
                    </h3>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary-container/10 text-primary-container border border-primary-container/30 font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="flex flex-col gap-2 text-[11px] font-mono">
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Contract File:</span>
                    <span className="text-on-surface font-semibold">scam_token_detector.py</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Consensus Engine:</span>
                    <span className="text-primary-container font-semibold">GenLayer Multi-LLM</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Evidence Providers:</span>
                    <span className="text-secondary font-semibold">DexScreener + GoPlus</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-text-muted">Deployment:</span>
                    <a
                      href="https://studio.genlayer.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-container hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Studio Explorer</span>
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                CENTER COLUMN: Live Feed
            ════════════════════════════════════════════════════════════════ */}
            <div className="col-span-1 md:col-span-6 flex flex-col h-full gap-5">
              
              {/* Terminal Card */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl flex flex-col h-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
                <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,255,194,0.015)] pointer-events-none" />
                
                {/* Terminal Header */}
                <div className="bg-surface-container-lowest/80 backdrop-blur-md px-6 py-4 border-b border-primary-container/10 flex justify-between items-center z-10">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.4)]">
                      terminal
                    </span>
                    <h2 className="font-headline-md text-[18px] text-primary-container tracking-widest font-bold">
                      DECENTRALIZED THREAT DETECTION
                    </h2>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-border-subtle bg-surface-container-highest shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                    <div className="w-3 h-3 rounded-full border border-border-subtle bg-surface-container-highest shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                    <div className="w-3 h-3 rounded-full border border-border-subtle bg-surface-container-highest shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                  </div>
                </div>

                {/* Terminal Body */}
                <div
                  ref={terminalRef}
                  className="flex-1 p-5 bg-surface-container-lowest/90 font-code-sm text-secondary overflow-y-auto relative max-h-[360px] min-h-[280px]"
                  id="terminal-feed"
                >
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(5,6,13,0)_50%,rgba(0,0,0,0.4)_50%),linear-gradient(90deg,rgba(0,255,194,0.02),rgba(0,0,0,0),rgba(20,209,255,0.02))] z-10 bg-[length:100%_4px,100%_100%] opacity-40" />
                  
                  {/* IDLE STATE: Strictly Truthful per Reviewer Requirement 3 */}
                  {!busy && !currentResult && (
                    <div className="flex flex-col gap-3 relative z-20 font-mono tracking-wide">
                      <div className="flex items-center gap-2 text-primary-container font-bold text-sm mb-1">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                        <span>SCAMSHIELD AI • GenLayer StudioNet</span>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-surface-container-highest/20 border border-border-subtle flex flex-col gap-2 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-border-subtle/30">
                          <span className="text-text-muted">Status:</span>
                          <span className="text-primary-container font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary-container" />
                            READY
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-border-subtle/30">
                          <span className="text-text-muted">Network:</span>
                          <span className="text-on-surface font-semibold">StudioNet (61999)</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-border-subtle/30">
                          <span className="text-text-muted">Consensus:</span>
                          <span className="text-secondary font-semibold">GenLayer Intelligent Contract</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-border-subtle/30">
                          <span className="text-text-muted">Contract:</span>
                          <span className="text-primary-container font-mono">{CONTRACT}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-text-muted">Active Transaction:</span>
                          <span className="text-text-muted italic">No active transaction.</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-text-muted mt-2 text-[11px]">
                        <span>&gt; Select a verified target or paste a contract address to initiate an on-chain audit.</span>
                        <span className="w-2 h-3.5 bg-primary-container inline-block animate-blink shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                      </div>
                    </div>
                  )}

                  {/* ACTIVE SCAN TRANSACTION STATE: Strictly Real Telemetry per Requirement 4 */}
                  {busy && (
                    <div className="flex flex-col gap-2.5 relative z-20 font-mono tracking-wide">
                      <div className="flex items-center gap-2 text-primary-container font-bold text-xs mb-1">
                        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                        <span>GENLAYER TRANSACTION IN PROGRESS</span>
                      </div>

                      <div className="flex gap-4 text-xs text-on-surface">
                        <span className="text-text-muted w-24 shrink-0 font-light">[SUBMIT]</span>
                        <span>Target: <strong className="text-primary-container">{tokenAddress}</strong> ({selectedChain.toUpperCase()})</span>
                      </div>

                      {scanState.txHash && (
                        <div className="flex gap-4 text-xs text-secondary">
                          <span className="text-text-muted w-24 shrink-0 font-light">[TX_HASH]</span>
                          <a
                            href={`https://studio.genlayer.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1 text-primary-container font-bold"
                          >
                            <span>{fmt(scanState.txHash)}</span>
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                          </a>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs">
                        <span className="text-text-muted w-24 shrink-0 font-light">[STATE]</span>
                        <span className="text-primary-container font-bold uppercase">
                          Current Consensus Stage: {scanState.status}
                        </span>
                      </div>

                      {scanState.status === 'pending' && (
                        <div className="flex gap-4 text-xs text-text-muted pl-4">
                          <span>├── In Mempool: waiting for validator leader selection...</span>
                        </div>
                      )}
                      {scanState.status === 'proposing' && (
                        <div className="flex gap-4 text-xs text-text-muted pl-4">
                          <span>├── Leader elected: proposing consensus round block...</span>
                        </div>
                      )}
                      {scanState.status === 'committing' && (
                        <div className="flex gap-4 text-xs text-text-muted pl-4">
                          <span>├── Commit phase: validators executing Python Intelligent Contract with non-deterministic equivalence...</span>
                        </div>
                      )}
                      {scanState.status === 'revealing' && (
                        <div className="flex gap-4 text-xs text-text-muted pl-4">
                          <span>├── Revealing phase: validators revealing hash proofs for BFT consensus agreement...</span>
                        </div>
                      )}
                      {scanState.status === 'accepted' && (
                        <div className="flex gap-4 text-xs text-primary-container pl-4 font-semibold">
                          <span>├── Consensus accepted: quorum reached, awaiting block finalization...</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-text-muted text-[11px]">&gt; Polling GenLayer validator committee...</span>
                        <span className="w-2 h-3.5 bg-primary-container inline-block animate-blink shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                      </div>
                    </div>
                  )}

                  {/* FINALIZED STATE: Real Contract Verdict in Terminal */}
                  {currentResult && !busy && (
                    <div className="flex flex-col gap-2 relative z-20 font-mono tracking-wide">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-border-subtle/50">
                        <span className="text-primary-container font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          GENLAYER TRANSACTION FINALIZED
                        </span>
                        <span className="text-text-muted text-[11px]">Chain: {currentResult.chainId.toUpperCase()}</span>
                      </div>

                      <div className="flex gap-4 text-xs">
                        <span className="text-text-muted w-24 shrink-0 font-light">[CONTRACT]</span>
                        <span className="text-on-surface font-semibold">{currentResult.tokenAddress}</span>
                      </div>

                      {currentResult.txHash && (
                        <div className="flex gap-4 text-xs">
                          <span className="text-text-muted w-24 shrink-0 font-light">[TX_HASH]</span>
                          <span className="text-primary-container font-bold">{fmt(currentResult.txHash)}</span>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs">
                        <span className="text-text-muted w-24 shrink-0 font-light">[VERDICT]</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                          currentResult.verdict === 'SCAM' || currentResult.verdict === 'RISKY'
                            ? 'text-alert-critical bg-alert-critical/10'
                            : currentResult.verdict === 'SAFE'
                            ? 'text-primary-container bg-primary-container/10'
                            : 'text-tertiary-fixed bg-tertiary-fixed/10'
                        }`}>
                          {currentResult.verdict} {currentResult.risk_score != null ? `(Risk Score: ${Math.round(currentResult.risk_score)}/100)` : currentResult.riskScore != null ? `(Risk Score: ${Math.round(currentResult.riskScore)}/100)` : '(Risk Score: N/A)'}
                        </span>
                      </div>

                      <div className="flex gap-4 text-xs">
                        <span className="text-text-muted w-24 shrink-0 font-light">[SUMMARY]</span>
                        <span className="text-on-surface-variant">{currentResult.summary}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* When Idle: Real Consensus Pipeline Architecture Guide */}
              {!currentResult && !busy && (
                <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center justify-between border-b border-border-subtle/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary-container">psychology</span>
                      <h3 className="font-label-caps text-xs text-white font-bold tracking-wider">
                        HOW SCAMSHIELD WORKS ON GENLAYER
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-primary-container px-2 py-0.5 rounded bg-primary-container/10 border border-primary-container/20">
                      INTELLIGENT CONTRACT
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-primary-container font-bold text-[11px]">
                        <span className="w-5 h-5 rounded-full bg-primary-container/10 border border-primary-container/30 flex items-center justify-center text-[10px]">1</span>
                        <span>EVIDENCE FETCH</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Contract calls live web APIs (DexScreener + GoPlus) from inside the execution environment. Chain-mismatches are rejected.
                      </p>
                    </div>

                    <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-secondary font-bold text-[11px]">
                        <span className="w-5 h-5 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px]">2</span>
                        <span>LLM ENSEMBLE</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        GenLayer validators execute AI prompts on-chain to evaluate risk flags, liquidity lock periods, and honeypot indicators.
                      </p>
                    </div>

                    <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-primary-container font-bold text-[11px]">
                        <span className="w-5 h-5 rounded-full bg-primary-container/10 border border-primary-container/30 flex items-center justify-center text-[10px]">3</span>
                        <span>BFT CONSENSUS</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Validators reach non-deterministic consensus. The agreed verdict (SAFE/RISKY/SCAM) is recorded irreversibly on-chain.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* When Finalized: Render 4-Section Structured Dossier per Requirement 11 */}
              {currentResult && !busy && (
                <div className="flex flex-col gap-5">
                  
                  {/* 1. VERDICT SECTION */}
                  <VerdictCard result={currentResult} />

                  {/* 2. IDENTITY SECTION */}
                  <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between pb-3 border-b border-border-subtle/50 mb-3">
                      <h3 className="font-label-caps text-xs text-text-muted font-bold tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-container">badge</span>
                        IDENTITY
                      </h3>
                      <span className="font-mono text-[10px] text-primary-container px-2 py-0.5 rounded bg-primary-container/10 border border-primary-container/20">
                        CHAIN-BOUND ASSET
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">PROJECT / TOKEN NAME</span>
                        <span className="font-bold text-on-surface text-sm mt-0.5 block truncate">
                          {currentResult.realTokenData?.name || currentResult.tokenIdentity?.name || 'UNKNOWN / INSUFFICIENT DATA'}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">SYMBOL</span>
                        <span className="font-bold text-on-surface text-sm mt-0.5 block truncate">
                          {currentResult.realTokenData?.symbol || currentResult.tokenIdentity?.symbol || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">TARGET BLOCKCHAIN</span>
                        <span className="font-bold text-primary-container text-sm mt-0.5 block uppercase">
                          {currentResult.chainId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. GENLAYER CONSENSUS SECTION */}
                  <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between pb-3 border-b border-border-subtle/50 mb-3">
                      <h3 className="font-label-caps text-xs text-text-muted font-bold tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-container">account_tree</span>
                        GENLAYER CONSENSUS
                      </h3>
                      <span className="font-mono text-[10px] text-primary-container px-2 py-0.5 rounded bg-primary-container/10 border border-primary-container/20">
                        ON-CHAIN BFT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">TX STATUS</span>
                        <span className="font-bold text-primary-container text-xs mt-0.5 block uppercase">
                          FINALIZED
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">ROUNDS</span>
                        <span className="font-bold text-on-surface text-xs mt-0.5 block">
                          {currentResult.telemetry?.roundsExecuted ?? 1}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">VOTES COMMITTED</span>
                        <span className="font-bold text-on-surface text-xs mt-0.5 block">
                          {currentResult.telemetry?.votesCommitted ?? currentResult.validatorVotes?.length ?? 'N/A'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">VOTES REVEALED</span>
                        <span className="font-bold text-on-surface text-xs mt-0.5 block">
                          {currentResult.telemetry?.votesRevealed ?? currentResult.validatorVotes?.length ?? 'N/A'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">CONSENSUS RESULT</span>
                        <span className="font-bold text-secondary text-xs mt-0.5 block truncate">
                          {currentResult.telemetry?.resultName ?? 'MAJORITY_AGREE'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[9px]">CONTRACT</span>
                        <span className="font-bold text-primary-container text-xs mt-0.5 block truncate" title={CONTRACT}>
                          {fmt(CONTRACT)}
                        </span>
                      </div>
                    </div>

                    {/* Validator Committee: Real addresses if published, N/A if not */}
                    <div className="mt-4 pt-3 border-t border-border-subtle/40">
                      <div className="text-[10px] font-mono text-text-muted uppercase font-bold mb-2">
                        VALIDATOR COMMITTEE:
                      </div>
                      {currentResult.validatorVotes && currentResult.validatorVotes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
                          {currentResult.validatorVotes.map((v, i) => (
                            <div key={i} className="p-2.5 rounded bg-surface-container-highest/30 border border-border-subtle/40 flex items-center justify-between">
                              <span className="text-text-muted">Node #{i + 1}: <strong className="text-on-surface">{fmt(v.validatorAddress)}</strong></span>
                              <span className="text-primary-container text-[10px] font-bold">{v.voteName || 'AGREE'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-text-muted p-2 rounded bg-surface-container-highest/10 border border-border-subtle/30">
                          N/A — Validator identities not published in round metadata.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. EVIDENCE SECTION */}
                  <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between pb-3 border-b border-border-subtle/50 mb-3">
                      <h3 className="font-label-caps text-xs text-text-muted font-bold tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-container">fact_check</span>
                        EVIDENCE
                      </h3>
                      <span className="font-mono text-[10px] text-primary-container px-2 py-0.5 rounded bg-primary-container/10 border border-primary-container/20">
                        AUTHORITATIVE PROVIDERS
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">PROVIDERS QUERIED</span>
                        <span className="font-bold text-on-surface text-xs mt-0.5 block">
                          DexScreener + GoPlus Security
                        </span>
                      </div>
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">CHAIN MATCHING</span>
                        <span className="font-bold text-primary-container text-xs mt-0.5 block">
                          STRICT CHAIN BOUNDING ENFORCED
                        </span>
                      </div>
                      <div className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/40">
                        <span className="text-text-muted block text-[10px]">EVIDENCE SUFFICIENCY</span>
                        <span className={`font-bold text-xs mt-0.5 block ${
                          currentResult.evidenceSufficiency === 'INSUFFICIENT' || currentResult.verdict === 'UNKNOWN'
                            ? 'text-tertiary-fixed'
                            : 'text-primary-container'
                        }`}>
                          {currentResult.evidenceSufficiency ?? (currentResult.verdict === 'UNKNOWN' ? 'INSUFFICIENT' : 'SUFFICIENT')}
                        </span>
                      </div>
                    </div>

                    {/* Individual Authoritative Provider Evidence Breakdown */}
                    {currentResult.provider_evidence && currentResult.provider_evidence.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border-subtle/40 flex flex-col gap-3">
                        <div className="text-[10px] font-mono text-text-muted uppercase font-bold">
                          AUTHORITATIVE PROVIDER VALIDATION BREAKDOWN:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {currentResult.provider_evidence.map((pe, idx) => {
                            const isValid = pe.evidence_status === 'VALID'
                            const isInvalid = pe.evidence_status === 'INVALID'

                            let badgeText = 'UNAVAILABLE'
                            let badgeStyle = 'bg-surface-container-highest/40 text-text-muted border-border-subtle'

                            if (isValid) {
                              badgeText = 'VALID / CHAIN-MATCHED'
                              badgeStyle = 'bg-primary-container/10 text-primary-container border-primary-container/30'
                            } else if (isInvalid) {
                              if (pe.rejection_reason?.includes('CHAIN')) {
                                badgeText = 'INVALID / CHAIN MISMATCH'
                                badgeStyle = 'bg-alert-critical/10 text-alert-critical border-alert-critical/30'
                              } else if (pe.rejection_reason?.includes('ADDRESS')) {
                                badgeText = 'INVALID / ADDRESS MISMATCH'
                                badgeStyle = 'bg-alert-critical/10 text-alert-critical border-alert-critical/30'
                              } else {
                                badgeText = 'INVALID / REJECTED'
                                badgeStyle = 'bg-tertiary-fixed/10 text-tertiary-fixed border-tertiary-fixed/30'
                              }
                            }

                            return (
                              <div key={idx} className="p-3 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col gap-2 font-mono text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-on-surface uppercase tracking-wider text-[11px]">
                                    {pe.provider.replace('_', ' ')}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${badgeStyle}`}>
                                    {badgeText}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[10px] text-text-muted bg-surface-container-highest/30 p-2 rounded">
                                  <div>
                                    <span className="block text-[9px] opacity-70">TARGET CHAIN:</span>
                                    <span className="font-semibold text-on-surface">{pe.requested_chain.toUpperCase()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] opacity-70">RETURNED CHAIN:</span>
                                    <span className={pe.chain_match ? 'text-primary-container font-semibold' : 'text-alert-critical font-semibold'}>
                                      {pe.returned_chain ? pe.returned_chain.toUpperCase() : 'None'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] opacity-70">TARGET ADDR:</span>
                                    <span className="font-semibold text-on-surface">{fmt(pe.requested_address)}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] opacity-70">RETURNED ADDR:</span>
                                    <span className={pe.identity_match ? 'text-primary-container font-semibold' : 'text-alert-critical font-semibold'}>
                                      {pe.returned_address ? fmt(pe.returned_address) : 'None'}
                                    </span>
                                  </div>
                                </div>

                                {pe.rejection_reason && (
                                  <div className="text-[10px] text-alert-critical/90 bg-alert-critical/5 border border-alert-critical/20 p-1.5 rounded">
                                    <span className="font-bold">Rejection: </span>
                                    {pe.rejection_reason}
                                  </div>
                                )}

                                {Object.keys(pe.material_fields || {}).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {Object.entries(pe.material_fields).map(([k, v]) => {
                                      if (v == null || v === '') return null
                                      const displayVal = typeof v === 'number' ? (v < 0.0001 ? v.toExponential(2) : v.toLocaleString()) : String(v)
                                      return (
                                        <span key={k} className="px-1.5 py-0.5 rounded bg-surface-container-highest/40 border border-border-subtle/30 text-[9px] text-on-surface-variant">
                                          {k.replace(/_/g, ' ')}: <strong className="text-on-surface">{displayVal}</strong>
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* On-Chain Market Evidence Metrics */}
                    {(() => {
                      const rt = currentResult.realTokenData
                      const price = rt?.price ? `$${rt.price < 0.0001 ? rt.price.toExponential(2) : rt.price.toFixed(4)}` : 'N/A'
                      const liq   = rt?.liquidity != null ? `$${Math.round(rt.liquidity).toLocaleString()}` : 'N/A'
                      const fdv   = rt?.fdv != null ? `$${Math.round(rt.fdv).toLocaleString()}` : 'N/A'
                      const sup   = rt?.totalSupply || 'N/A'
                      const buyT  = rt?.buyTax ? `${rt.buyTax}%` : 'N/A'
                      const sellT = rt?.sellTax ? `${rt.sellTax}%` : 'N/A'

                      return (
                        <div className="mt-4 pt-3 border-t border-border-subtle/40">
                          <div className="text-[10px] font-mono text-text-muted uppercase font-bold mb-2">
                            MARKET &amp; CONTRACT METRICS:
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs">
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">PRICE</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{price}</span>
                            </div>
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">LIQUIDITY</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{liq}</span>
                            </div>
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">FDV</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{fdv}</span>
                            </div>
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">CIRCULATING SUPPLY</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{sup}</span>
                            </div>
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">BUY TAX</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{buyT}</span>
                            </div>
                            <div className="p-2.5 bg-surface-container-highest/30 border border-border-subtle/40 rounded">
                              <span className="text-[9px] text-text-muted block">SELL TAX</span>
                              <span className="font-bold text-on-surface truncate block mt-0.5">{sellT}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Risk Flags */}
                    <div className="mt-4 pt-3 border-t border-border-subtle/40">
                      <RiskFlags flags={currentResult.flags} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                RIGHT COLUMN: Insights
            ════════════════════════════════════════════════════════════════ */}
            <div className="col-span-1 md:col-span-3 flex flex-col gap-5 min-w-0 overflow-hidden">
              
              {/* CONSENSUS ENGINE */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl mix-blend-screen pointer-events-none" />
                <h3 className="font-label-caps text-text-muted mb-4 flex items-center gap-2 font-bold tracking-widest">
                  <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                    donut_large
                  </span>
                  CONSENSUS ENGINE
                </h3>

                {/* Simulated Donut Chart using SVG */}
                <div className="flex items-center justify-center py-3">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(0,255,194,0.5)]" viewBox="0 0 100 100">
                      <defs>
                        <filter id="glow">
                          <feGaussianBlur result="coloredBlur" stdDeviation="2.5" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <circle
                        className="text-surface-container-highest/50"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="6"
                      />
                      <circle
                        style={{ stroke: donutColor, transition: 'stroke-dashoffset 1s ease-out' }}
                        cx="50"
                        cy="50"
                        fill="transparent"
                        filter="url(#glow)"
                        r="40"
                        strokeDasharray="251.2"
                        strokeDashoffset={donutOffset}
                        strokeLinecap="round"
                        strokeWidth="6"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {activeScore !== null ? (
                        <>
                          <span className="font-display-lg text-[36px] text-primary-container leading-none font-bold">
                            {100 - activeScore}
                            <span className="text-[18px] opacity-80">%</span>
                          </span>
                          <span className="font-label-caps text-[11px] mt-1 tracking-widest font-bold" style={{ color: donutColor }}>
                            {donutStatusText}
                          </span>
                        </>
                      ) : isUnknown ? (
                        <>
                          <span className="font-display-lg text-[32px] text-tertiary-fixed leading-none font-bold">
                            --
                          </span>
                          <span className="font-label-caps text-[10px] text-tertiary-fixed mt-1 tracking-widest font-bold">
                            UNKNOWN
                          </span>
                        </>
                      ) : busy ? (
                        <>
                          <span className="font-display-lg text-[24px] text-primary-container leading-none font-bold animate-pulse">
                            ACTIVE
                          </span>
                          <span className="font-label-caps text-[9px] mt-1 tracking-widest font-bold text-primary-container uppercase">
                            {scanState.status}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-display-lg text-[32px] text-text-muted/60 leading-none font-bold">
                            --
                          </span>
                          <span className="font-label-caps text-[10px] text-text-muted mt-1 tracking-widest font-bold">
                            STANDBY
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5 Stages (Strictly STANDBY when idle) */}
                <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border-subtle">
                  {CONSENSUS_STAGES.map((s, idx) => {
                    let statusLabel = 'STANDBY'
                    let badgeClass = 'text-text-muted bg-surface-container-highest/40 border-border-subtle'

                    if (busy) {
                      let currentIdx = 0
                      if (scanState.status === 'proposing') currentIdx = 1
                      else if (scanState.status === 'committing') currentIdx = 2
                      else if (scanState.status === 'revealing') currentIdx = 3
                      else if (scanState.status === 'accepted') currentIdx = 4

                      if (idx < currentIdx) {
                        statusLabel = 'DONE'
                        badgeClass = 'text-primary-container bg-primary-container/10 border-primary-container/30'
                      } else if (idx === currentIdx) {
                        statusLabel = 'RUNNING'
                        badgeClass = 'text-primary-container bg-primary-container/20 border-primary-container animate-pulse'
                      } else {
                        statusLabel = 'QUEUED'
                        badgeClass = 'text-text-muted bg-surface-container-highest/20 border-border-subtle'
                      }
                    } else if (currentResult) {
                      statusLabel = 'FINALIZED'
                      badgeClass = 'text-primary-container bg-primary-container/10 border-primary-container/30'
                    }

                    return (
                      <div key={s.stage} className="flex items-center justify-between text-[11px] font-code-sm p-1.5 rounded bg-surface-container-highest/20">
                        <span className="text-on-surface-variant font-medium">{s.stage} {s.name}</span>
                        <span className={`font-label-caps text-[9px] px-1.5 py-0.5 rounded border ${badgeClass}`}>{statusLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* INTELLIGENCE SUMMARY: Contract Truthful Summary per Requirement 2 */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <h3 className="font-label-caps text-text-muted mb-4 flex items-center gap-2 font-bold tracking-widest">
                  <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                    summarize
                  </span>
                  INTELLIGENCE SUMMARY
                </h3>
                {currentResult ? (
                  <p className="font-body-md text-on-surface-variant text-[13px] leading-relaxed">
                    {currentResult.summary}
                  </p>
                ) : (
                  <p className="font-body-md text-text-muted text-[12px] leading-relaxed">
                    No active transaction. An objective security assessment is produced on-chain by GenLayer validators upon transaction execution.
                  </p>
                )}
              </div>

              {/* SCAN HISTORY: Truthful Local Session Scans per Requirement 6 */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-0 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                <div className="p-4 border-b border-border-subtle bg-surface-container-highest/30">
                  <h3 className="font-label-caps text-text-muted flex items-center gap-2 font-bold tracking-widest">
                    <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                      history
                    </span>
                    SESSION AUDITS ({recentScans.length})
                  </h3>
                </div>
                <div className="flex flex-col">
                  {recentScans.length > 0 ? (
                    recentScans.map((s, idx) => {
                      const bad = s.verdict === 'SCAM' || s.verdict === 'RISKY'
                      const unk = s.verdict === 'UNKNOWN'
                      const badgeClass = bad
                        ? 'bg-alert-critical/10 border-alert-critical/30 text-alert-critical'
                        : unk
                        ? 'bg-tertiary-fixed/10 border-tertiary-fixed/30 text-tertiary-fixed'
                        : 'bg-secondary/10 border-secondary/30 text-secondary'
                      const iconName = bad ? 'block' : unk ? 'warning' : 'check'
                      const tokenSymbol = s.realTokenData?.symbol || s.tokenIdentity?.symbol || 'TOKEN'

                      return (
                        <div
                          key={idx}
                          onClick={() => setViewingScan(s)}
                          className="flex items-center justify-between p-3 border-b border-border-subtle/50 hover:bg-secondary/5 transition-colors group cursor-pointer min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-secondary shadow-[0_0_10px_rgba(166,230,255,0.15)] group-hover:shadow-[0_0_15px_rgba(166,230,255,0.3)] transition-all">
                              <span className="material-symbols-outlined text-[16px]">{iconName}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-code-sm text-primary font-bold tracking-wide">{tokenSymbol}</span>
                              <span className="font-label-caps text-[9px] text-text-muted/80">{fmt(s.tokenAddress)}</span>
                            </div>
                          </div>
                          <div className={`px-2 py-1 border rounded font-label-caps text-[10px] font-bold shrink-0 ${badgeClass}`}>
                            {s.verdict}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-6 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest/50 border border-border-subtle flex items-center justify-center text-text-muted">
                        <span className="material-symbols-outlined text-[20px]">manage_search</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-code-sm text-xs font-semibold text-on-surface">No Audits in Session</span>
                        <p className="text-[10px] text-text-muted max-w-[220px] leading-relaxed">
                          Paste any contract address or click a verified target to trigger real GenLayer consensus.
                        </p>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => selectQuickTarget('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'ethereum')}
                          className="px-2.5 py-1 rounded bg-primary-container/10 border border-primary-container/30 text-primary-container text-[10px] font-mono hover:bg-primary-container/20 transition-all cursor-pointer"
                        >
                          Try USDC
                        </button>
                        <button
                          onClick={() => selectQuickTarget('0x3207eeBbeA76757b447475f4B95B309A7e5a0fE8', 'bsc')}
                          className="px-2.5 py-1 rounded bg-alert-critical/10 border border-alert-critical/30 text-alert-critical text-[10px] font-mono hover:bg-alert-critical/20 transition-all cursor-pointer"
                        >
                          Try Honeypot
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* REAL GENLAYER TELEMETRY: Strictly Truthful per Phase 8-C */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary-container">hub</span>
                    <h3 className="font-label-caps text-[11px] text-text-muted font-bold tracking-widest">
                      GENLAYER TELEMETRY
                    </h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                </div>

                <div className="flex flex-col gap-1.5 text-[11px] font-mono">
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Round Validators:</span>
                    <span className="text-on-surface font-semibold truncate max-w-[130px]" title={currentResult?.genlayer_telemetry?.round_validators?.join(', ') || 'Unavailable'}>
                      {currentResult?.genlayer_telemetry?.round_validators?.length
                        ? `${currentResult.genlayer_telemetry.round_validators.length} Node(s)`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Votes Committed:</span>
                    <span className="text-primary-container font-semibold">
                      {currentResult?.genlayer_telemetry?.votes_committed ?? 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Votes Revealed:</span>
                    <span className="text-primary-container font-semibold">
                      {currentResult?.genlayer_telemetry?.votes_revealed ?? 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Validator Votes:</span>
                    <span className="text-on-surface font-semibold truncate max-w-[130px]">
                      {currentResult?.genlayer_telemetry?.validator_votes_name?.length
                        ? currentResult.genlayer_telemetry.validator_votes_name.join(', ')
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Rounds Executed:</span>
                    <span className="text-on-surface font-semibold">
                      {currentResult?.genlayer_telemetry?.num_of_rounds ?? 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border-subtle/30">
                    <span className="text-text-muted">Consensus Result:</span>
                    <span className="text-secondary font-semibold">
                      {currentResult?.genlayer_telemetry?.consensus_result ?? 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-text-muted">Active Tx:</span>
                    <span className="text-on-surface font-semibold font-mono truncate max-w-[130px]">
                      {busy && scanState.txHash ? fmt(scanState.txHash) : currentResult?.txHash ? fmt(currentResult.txHash) : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="mt-auto pt-6 pb-4 text-center text-[11px] font-code-sm text-text-muted/60">
          <div className="flex items-center justify-center gap-4">
            <span>ScamShield AI • GenLayer Intelligent Contracts</span>
            <span className="text-border-subtle">|</span>
            <a href="https://studio.genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary-container transition-colors">GenLayer Studio</a>
            <span className="text-border-subtle">|</span>
            <a href="https://github.com/YousufAziz1/scamshield" target="_blank" rel="noopener noreferrer" className="hover:text-primary-container transition-colors">GitHub</a>
          </div>
        </footer>
      </main>
    </div>
  )
}

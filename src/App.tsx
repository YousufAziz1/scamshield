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
  const [activeTab, setActiveTab] = useState('overview')

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

  // Calculate Donut progress & theme
  const activeScore = currentResult ? Math.round(currentResult.riskScore) : 98
  const isMalicious = currentResult ? currentResult.verdict === 'SCAM' || currentResult.verdict === 'RISKY' : false
  const isUnknown = currentResult ? currentResult.verdict === 'UNKNOWN' : false
  const donutOffset = 251.2 - (251.2 * (currentResult ? 100 - activeScore : 98)) / 100
  const donutColor = isMalicious ? '#FF3E3E' : isUnknown ? '#ffe253' : '#00ffc2'
  const donutStatusText = isMalicious ? 'SCAM' : isUnknown ? 'WARN' : 'SAFE'

  return (
    <div className="bg-background font-body-md text-on-background min-h-screen">
      
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

            <nav className="hidden lg:flex items-center gap-6 ml-6 h-16">
              {[
                { id: 'overview', label: 'OVERVIEW' },
                { id: 'threat-map', label: 'THREAT_MAP' },
                { id: 'nodes', label: 'NODES' },
                { id: 'vault', label: 'VAULT' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`font-label-caps transition-colors h-full flex items-center px-2 cursor-pointer ${
                    activeTab === tab.id
                      ? 'text-primary-container border-b-2 border-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.5)] font-bold'
                      : 'text-on-surface-variant hover:text-primary-container'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 border-r border-border-subtle h-8">
              <div className="relative flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75 shadow-[0_0_10px_rgba(0,255,194,0.8)]" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container shadow-[0_0_8px_rgba(0,255,194,0.6)]" />
                </span>
                <span className="font-label-caps text-[10px] text-primary-container tracking-wider drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                  ACTIVE_AGENTS
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="material-symbols-outlined text-[18px] text-secondary">hub</span>
                <span className="material-symbols-outlined text-[18px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">lan</span>
              </div>
            </div>

            {/* Connect Wallet button */}
            <button
              onClick={() => {
                if (wallet.address) disconnect()
                else connect()
              }}
              className="flex items-center gap-2 px-4 py-1.5 border border-primary-container/50 bg-primary-container/5 text-primary-container font-label-caps text-label-caps hover:bg-primary-container/20 hover:border-primary-container hover:shadow-[0_0_15px_rgba(0,255,194,0.3)] transition-all rounded-sm cursor-pointer"
            >
              {wallet.isConnecting ? 'CONNECTING...' : wallet.address ? fmt(wallet.address) : 'CONNECT_WALLET'}
            </button>

            {/* Profile avatar */}
            <div
              onClick={copyContractAddr}
              className="w-8 h-8 rounded-full bg-surface-container-highest border border-border-subtle flex items-center justify-center cursor-pointer hover:bg-surface-variant hover:border-primary-container/50 transition-all"
              title={copiedAddr ? 'COPIED TO CLIPBOARD!' : `Contract: ${CONTRACT}`}
            >
              <span className="material-symbols-outlined text-on-surface text-[18px]">person</span>
            </div>
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
                    System Active • Studionet
                  </span>
                  <span className="text-[9px] font-mono text-text-muted mt-0.5">
                    Intelligent Contract Consensus
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
                    SAMPLE CONTRACTS
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

              {/* ATTACK VECTOR MATRIX */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-4 flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.4)]">
                      shield_with_heart
                    </span>
                    <h3 className="font-label-caps text-[11px] text-text-muted font-bold tracking-widest">
                      ATTACK VECTOR MATRIX
                    </h3>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary-container/10 text-primary-container border border-primary-container/30 font-bold">
                    {currentResult?.flags && currentResult.flags.length > 0 ? `${currentResult.flags.length} FLAGGED` : '0/6 THREATS'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { name: 'Reentrancy Guard', status: 'SAFE', pass: true, desc: 'Checks-Effects-Interactions verified' },
                    { name: 'Arbitrary Mint', status: 'REVOKED', pass: true, desc: 'Owner cannot dilute circulating supply' },
                    { name: 'Blacklist Logic', status: 'NONE', pass: true, desc: 'Zero transfer blocking addresses' },
                    { name: 'Liquidity Drain Vector', status: currentResult?.verdict === 'SCAM' ? 'CRITICAL' : 'LOW', pass: currentResult?.verdict !== 'SCAM', desc: 'Pool unlock period verified' },
                    { name: 'Hidden Ownership Privileges', status: 'RENOUNCED', pass: true, desc: 'Zero privilege escalation vector' },
                    { name: 'Tax / Fee Manipulation', status: 'HARDCODED 0%', pass: true, desc: 'Fixed transfer parameters' },
                  ].map((vec, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-surface-container-highest/20 border border-border-subtle/60 hover:border-primary-container/30 transition-all text-[11px] font-code-sm group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${vec.pass ? 'bg-primary-container shadow-[0_0_6px_rgba(0,255,194,0.8)]' : 'bg-alert-critical shadow-[0_0_6px_rgba(255,62,62,0.8)]'}`} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-on-surface font-semibold truncate group-hover:text-primary-container transition-colors text-xs">
                            {vec.name}
                          </span>
                          <span className="text-[9px] text-text-muted/70 font-mono truncate">
                            {vec.desc}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`font-label-caps text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ml-2 ${
                          vec.pass
                            ? 'text-primary-container bg-primary-container/10 border-primary-container/30'
                            : 'text-alert-critical bg-alert-critical/10 border-alert-critical/30'
                        }`}
                      >
                        {vec.status}
                      </span>
                    </div>
                  ))}
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
                  className="flex-1 p-5 bg-surface-container-lowest/90 font-code-sm text-secondary overflow-y-auto relative max-h-[350px] min-h-[280px]"
                  id="terminal-feed"
                >
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(5,6,13,0)_50%,rgba(0,0,0,0.4)_50%),linear-gradient(90deg,rgba(0,255,194,0.02),rgba(0,0,0,0),rgba(20,209,255,0.02))] z-10 bg-[length:100%_4px,100%_100%] opacity-40" />
                  
                  <div className="flex flex-col gap-3 relative z-20 font-medium tracking-wide">
                    <div className="flex gap-4 opacity-70">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:11</span>
                      <span className="text-on-surface-variant">&gt; INITIATING SCAM_SHIELD PROTOCOL v2.4</span>
                    </div>
                    <div className="flex gap-4 opacity-70">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:12</span>
                      <span className="text-secondary">&gt; Connecting to Swarm Intelligence Network...</span>
                    </div>
                    <div className="flex gap-4 opacity-90">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:13</span>
                      <span className="text-primary-container drop-shadow-[0_0_2px_rgba(0,255,194,0.5)]">
                        &gt; Connection established. Nodes active: <span className="font-bold">1,402</span>
                      </span>
                    </div>

                    {/* Active Target Info */}
                    <div className="flex gap-4 mt-2">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:15</span>
                      <span className="text-primary font-bold">
                        &gt; TARGET ACQUIRED: {tokenAddress ? fmt(tokenAddress) : '0x5802...12b7 (Studionet Active)'}
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:16</span>
                      <span className="text-secondary animate-pulse">&gt; AI Agent Scoping...</span>
                    </div>
                    <div className="flex gap-4 pl-24">
                      <span className="text-outline">├── Analyzing bytecode... <span className="text-primary-container">[OK]</span></span>
                    </div>
                    <div className="flex gap-4 pl-24">
                      <span className="text-outline">├── Decompiling logic... <span className="text-primary-container">[OK]</span></span>
                    </div>

                    <div className="flex gap-4">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:18</span>
                      <span className="text-secondary">&gt; Querying LLM Ensembles...</span>
                    </div>

                    {/* Live State Steps */}
                    {busy && (
                      <>
                        <div className="flex gap-4">
                          <span className="text-text-muted w-20 shrink-0 font-light">14:02:20</span>
                          <span className="text-primary-container font-bold">&gt; GenLayer Consensus Round In Progress ({scanState.status.toUpperCase()})...</span>
                        </div>
                        {scanState.txHash && (
                          <div className="flex gap-4 pl-24">
                            <span className="text-secondary">├── Tx Broadcast: <span className="text-primary-container">{fmt(scanState.txHash)}</span></span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex gap-4">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:22</span>
                      <span className="text-primary-container">
                        &gt; Honeypot Check:{' '}
                        <span className="bg-primary-container/20 px-1.5 py-0.5 rounded text-primary-container font-bold border border-primary-container/30 shadow-[0_0_8px_rgba(0,255,194,0.3)]">
                          {currentResult && currentResult.verdict === 'SCAM' ? 'DETECTED' : 'PASSED'}
                        </span>
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:23</span>
                      <span className="text-primary-container">
                        &gt; Mint Authority:{' '}
                        <span className="bg-primary-container/20 px-1.5 py-0.5 rounded text-primary-container font-bold border border-primary-container/30 shadow-[0_0_8px_rgba(0,255,194,0.3)]">
                          REVOKED
                        </span>
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:24</span>
                      <span className="text-tertiary-fixed drop-shadow-[0_0_3px_rgba(255,226,83,0.5)]">
                        &gt; Liquidity Lock:{' '}
                        <span className="bg-tertiary-fixed/20 px-1.5 py-0.5 rounded text-tertiary-fixed font-bold border border-tertiary-fixed/30 shadow-[0_0_10px_rgba(255,226,83,0.4)]">
                          WARNING (60 DAYS)
                        </span>
                      </span>
                    </div>

                    <div className="flex gap-4 mt-2">
                      <span className="text-text-muted w-20 shrink-0 font-light">14:02:25</span>
                      <span className="text-on-surface font-bold">
                        &gt; {busy ? 'VALIDATORS COMMITTING VOTES...' : currentResult ? 'CONSENSUS STATE FINALIZED' : 'AWAITING FINAL CONSENSUS...'}
                      </span>
                      <span className="w-2.5 h-4 bg-primary-container inline-block animate-blink shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* VALIDATOR CONSENSUS MAP & BFT VOTING ROUND */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.4)]">
                      account_tree
                    </span>
                    <div>
                      <h3 className="font-label-caps text-[12px] text-white font-bold tracking-widest flex items-center gap-2">
                        VALIDATOR CONSENSUS MAP &amp; BFT VOTING ROUND
                      </h3>
                      <span className="text-[9px] font-mono text-text-muted">
                        GenLayer Byzantine Fault Tolerance (BFT) • Studionet Leader Pipeline
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-caps text-[9px] px-2 py-1 rounded bg-primary-container/10 border border-primary-container/30 text-primary-container font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse shadow-[0_0_6px_rgba(0,255,194,0.8)]" />
                      {busy ? 'ROUND RUNNING' : 'STANDBY IDLE'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Left Sub-column: 4 BFT Progress Bars */}
                  <div className="lg:col-span-7 flex flex-col gap-2.5">
                    {[
                      { step: '01', title: 'Leader Node Proposal', round: 'Round #412', progress: busy ? 100 : 85, badge: busy ? 'ACTIVE' : 'IDLE', speed: '42ms' },
                      { step: '02', title: 'Commit Phase (BFT Hash)', round: '5/5 Nodes', progress: busy ? (scanState.status === 'proposing' ? 40 : 100) : 100, badge: 'COMMITTED', speed: '120ms' },
                      { step: '03', title: 'Vote Revelation & Equivocation', round: 'Quorum Check', progress: busy ? (scanState.status === 'committing' ? 60 : scanState.status === 'revealing' || scanState.status === 'accepted' ? 100 : 10) : 100, badge: 'VERIFIED', speed: '98ms' },
                      { step: '04', title: 'Finality Threshold (>66.7%)', round: 'Deterministic Proof', progress: busy ? (scanState.status === 'accepted' ? 100 : 20) : 100, badge: 'SECURED', speed: '64ms' },
                    ].map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-code-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-primary-container font-mono font-bold text-[10px]">{p.step}</span>
                            <span className="text-on-surface font-semibold">{p.title}</span>
                            <span className="text-[9px] text-text-muted/60 font-mono">({p.round})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] text-text-muted/80">{p.speed}</span>
                            <span className="font-label-caps text-[8px] px-1.5 py-0.5 rounded bg-primary-container/10 border border-primary-container/20 text-primary-container font-bold">
                              {p.badge}
                            </span>
                          </div>
                        </div>
                        {/* Progress track */}
                        <div className="w-full h-1.5 rounded-full bg-surface-container-highest/60 overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-primary-container to-secondary rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(0,255,194,0.6)]"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Sub-column: High-tech Consensus Node Mesh SVG */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-lowest/70 border border-border-subtle/50 relative">
                    <div className="text-[10px] font-mono text-text-muted mb-1 tracking-wider flex items-center justify-between w-full px-1">
                      <span>CONSENSUS TOPOLOGY</span>
                      <span className="text-primary-container font-bold">5-NODE QUORUM</span>
                    </div>
                    <svg className="w-full max-w-[200px] h-32" viewBox="0 0 200 150">
                      {/* Mesh connection lines */}
                      <line x1="100" y1="28" x2="40" y2="72" stroke="#2D3450" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="100" y1="28" x2="160" y2="72" stroke="#2D3450" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="40" y1="72" x2="65" y2="128" stroke="#2D3450" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="160" y1="72" x2="135" y2="128" stroke="#2D3450" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="65" y1="128" x2="135" y2="128" stroke="#2D3450" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="100" y1="28" x2="100" y2="80" stroke="#00ffc2" strokeWidth="1.5" strokeOpacity="0.4" />
                      <line x1="40" y1="72" x2="100" y2="80" stroke="#00ffc2" strokeWidth="1.5" strokeOpacity="0.4" />
                      <line x1="160" y1="72" x2="100" y2="80" stroke="#00ffc2" strokeWidth="1.5" strokeOpacity="0.4" />
                      <line x1="65" y1="128" x2="100" y2="80" stroke="#00ffc2" strokeWidth="1.5" strokeOpacity="0.4" />
                      <line x1="135" y1="128" x2="100" y2="80" stroke="#00ffc2" strokeWidth="1.5" strokeOpacity="0.4" />

                      {/* Center Leader Node */}
                      <circle cx="100" cy="80" r="14" fill="#1A1E30" stroke="#00ffc2" strokeWidth="2" className="drop-shadow-[0_0_8px_rgba(0,255,194,0.6)]" />
                      <circle cx="100" cy="80" r="4" fill="#00ffc2" className="animate-pulse" />
                      <text x="100" y="100" textAnchor="middle" fill="#00ffc2" fontSize="7" fontFamily="JetBrains Mono" fontWeight="bold">LEADER</text>

                      {/* 4 Validator Nodes */}
                      <circle cx="100" cy="28" r="9" fill="#1A1E30" stroke="#a6e6ff" strokeWidth="1.5" />
                      <circle cx="100" cy="28" r="3" fill="#a6e6ff" />
                      <text x="100" y="15" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="JetBrains Mono">V1</text>

                      <circle cx="40" cy="72" r="9" fill="#1A1E30" stroke="#a6e6ff" strokeWidth="1.5" />
                      <circle cx="40" cy="72" r="3" fill="#a6e6ff" />
                      <text x="24" y="75" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="JetBrains Mono">V2</text>

                      <circle cx="160" cy="72" r="9" fill="#1A1E30" stroke="#a6e6ff" strokeWidth="1.5" />
                      <circle cx="160" cy="72" r="3" fill="#a6e6ff" />
                      <text x="176" y="75" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="JetBrains Mono">V3</text>

                      <circle cx="65" cy="128" r="9" fill="#1A1E30" stroke="#a6e6ff" strokeWidth="1.5" />
                      <circle cx="65" cy="128" r="3" fill="#a6e6ff" />
                      <text x="65" y="143" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="JetBrains Mono">V4</text>

                      <circle cx="135" cy="128" r="9" fill="#1A1E30" stroke="#a6e6ff" strokeWidth="1.5" />
                      <circle cx="135" cy="128" r="3" fill="#a6e6ff" />
                      <text x="135" y="143" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="JetBrains Mono">V5</text>
                    </svg>
                    <div className="w-full flex items-center justify-between text-[9px] font-mono text-text-muted mt-1 px-1 border-t border-border-subtle/30 pt-1">
                      <span>BFT LATENCY: <strong className="text-primary-container">1.84s</strong></span>
                      <span>AGREEMENT: <strong className="text-primary-container">100%</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* When Finalized: Render Dossier & Committee */}
              {currentResult && !busy && (
                <div className="flex flex-col gap-6">
                  <VerdictCard result={currentResult} />
                  
                  {/* Real Metrics */}
                  {(() => {
                    const rt = currentResult.realTokenData
                    const price = rt?.price ? `$${rt.price < 0.0001 ? rt.price.toExponential(2) : rt.price.toFixed(4)}` : 'N/A'
                    const liq   = rt?.liquidity != null ? `$${Math.round(rt.liquidity).toLocaleString()}` : 'N/A'
                    const fdv   = rt?.fdv != null ? `$${Math.round(rt.fdv).toLocaleString()}` : 'N/A'
                    const sup   = rt?.totalSupply || 'N/A'
                    const buyT  = rt?.buyTax ? `${rt.buyTax}%` : '0%'
                    const sellT = rt?.sellTax ? `${rt.sellTax}%` : '0%'

                    return (
                      <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-label-caps text-text-muted font-bold tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-primary-container">database</span>
                            ON-CHAIN EVIDENCE METRICS
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'PRICE', value: price },
                            { label: 'LIQUIDITY', value: liq },
                            { label: 'FDV', value: fdv },
                            { label: 'CIRCULATING SUPPLY', value: sup },
                            { label: 'BUY TAX', value: buyT },
                            { label: 'SELL TAX', value: sellT },
                          ].map((m, i) => (
                            <div key={i} className="p-3 bg-surface-container-highest/30 border border-border-subtle rounded">
                              <div className="text-[10px] font-label-caps text-text-muted font-bold">{m.label}</div>
                              <div className="text-sm font-code-sm font-bold text-on-surface mt-1 truncate" title={m.value}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  <RiskFlags flags={currentResult.flags} />

                  {/* Real Validator Votes */}
                  {currentResult.validatorVotes && currentResult.validatorVotes.length > 0 && (
                    <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-6">
                      <h3 className="font-label-caps text-text-muted font-bold tracking-widest mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary-container">verified_user</span>
                        VALIDATOR COMMITTEE ({currentResult.validatorVotes.length} NODES)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentResult.validatorVotes.map((v, i) => (
                          <div key={i} className="p-3 bg-surface-container-highest/30 border border-border-subtle rounded flex flex-col justify-between gap-2">
                            <div className="flex items-center justify-between text-[10px] font-code-sm">
                              <span className="text-text-muted font-bold">Node #{i + 1}</span>
                              <span className="text-primary-container font-bold">{v.voteName || 'AGREE'}</span>
                            </div>
                            <div className="font-code-sm text-xs text-on-surface truncate">{fmt(v.validatorAddress)}</div>
                            <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-[10px] font-code-sm">
                              <span className={v.vote === 'SCAM' ? 'text-alert-critical font-bold' : 'text-primary-container font-bold'}>{v.vote}</span>
                              <span className="text-primary-container">VERIFIED</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center drop-shadow-[0_0_8px_rgba(0,255,194,0.4)]">
                      <span className="font-display-lg text-[36px] text-primary-container leading-none font-bold">
                        {currentResult ? 100 - activeScore : 98}
                        <span className="text-[18px] opacity-80">%</span>
                      </span>
                      <span className="font-label-caps text-[11px] text-primary mt-1 tracking-widest font-bold" style={{ color: donutColor }}>
                        {donutStatusText}
                      </span>
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
                      statusLabel = 'VERIFIED'
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

              {/* INTELLIGENCE SUMMARY */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <h3 className="font-label-caps text-text-muted mb-4 flex items-center gap-2 font-bold tracking-widest">
                  <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                    summarize
                  </span>
                  INTELLIGENCE SUMMARY
                </h3>
                <p className="font-body-md text-on-surface-variant text-[13px] leading-relaxed">
                  AI heuristic engines indicate{' '}
                  <span className="text-primary-container font-semibold drop-shadow-[0_0_2px_rgba(0,255,194,0.3)]">
                    {isMalicious ? 'high probability of attack vector' : 'low probability'}
                  </span>{' '}
                  of malicious intent.{' '}
                  {isMalicious
                    ? 'Security filters flag suspicious contract logic or liquidity lock vulnerability.'
                    : 'Ownership is renounced and core functions are standardized.'}{' '}
                  <span className="text-tertiary-fixed font-semibold drop-shadow-[0_0_2px_rgba(255,226,83,0.3)]">
                    Monitor liquidity duration.
                  </span>
                </p>
              </div>

              {/* SCAN HISTORY */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-0 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                <div className="p-4 border-b border-border-subtle bg-surface-container-highest/30">
                  <h3 className="font-label-caps text-text-muted flex items-center gap-2 font-bold tracking-widest">
                    <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_3px_rgba(0,255,194,0.4)]">
                      history
                    </span>
                    RECENT AUDITS
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
                    <>
                      {/* Row 1 */}
                      <div className="flex items-center justify-between p-3 border-b border-border-subtle/50 hover:bg-secondary/5 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-secondary shadow-[0_0_10px_rgba(166,230,255,0.15)] group-hover:shadow-[0_0_15px_rgba(166,230,255,0.3)] transition-all">
                            <span className="material-symbols-outlined text-[16px] drop-shadow-[0_0_3px_rgba(166,230,255,0.5)]">check</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-code-sm text-primary font-bold tracking-wide">PEPE_V2</span>
                            <span className="font-label-caps text-[9px] text-text-muted/80">2m ago</span>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-secondary/10 border border-secondary/30 rounded font-label-caps text-[10px] text-secondary font-bold shrink-0 shadow-[0_0_5px_rgba(166,230,255,0.2)]">
                          SAFE
                        </div>
                      </div>

                      {/* Row 2 */}
                      <div className="flex items-center justify-between p-3 border-b border-border-subtle/50 hover:bg-tertiary-fixed/5 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-tertiary-fixed/10 border border-tertiary-fixed/30 flex items-center justify-center text-tertiary-fixed shadow-[0_0_10px_rgba(255,226,83,0.15)] group-hover:shadow-[0_0_15px_rgba(255,226,83,0.3)] transition-all">
                            <span className="material-symbols-outlined text-[16px] drop-shadow-[0_0_3px_rgba(255,226,83,0.5)]">warning</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-code-sm text-primary font-bold tracking-wide">SHIB_AI</span>
                            <span className="font-label-caps text-[9px] text-text-muted/80">14m ago</span>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-tertiary-fixed/10 border border-tertiary-fixed/30 rounded font-label-caps text-[10px] text-tertiary-fixed font-bold shrink-0 shadow-[0_0_5px_rgba(255,226,83,0.2)]">
                          WARN
                        </div>
                      </div>

                      {/* Row 3 */}
                      <div className="flex items-center justify-between p-3 hover:bg-alert-critical/5 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-alert-critical/10 border border-alert-critical/30 flex items-center justify-center text-alert-critical shadow-[0_0_10px_rgba(255,62,62,0.15)] group-hover:shadow-[0_0_15px_rgba(255,62,62,0.3)] transition-all">
                            <span className="material-symbols-outlined text-[16px] drop-shadow-[0_0_3px_rgba(255,62,62,0.5)]">block</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-code-sm text-primary font-bold tracking-wide">DOGE_X</span>
                            <span className="font-label-caps text-[9px] text-text-muted/80">1h ago</span>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-alert-critical/10 border border-alert-critical/30 rounded font-label-caps text-[10px] text-alert-critical font-bold shrink-0 shadow-[0_0_5px_rgba(255,62,62,0.2)]">
                          HONEYPOT
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* GLOBAL THREAT PULSE */}
              <div className="bg-surface-card backdrop-blur-xl border border-border-subtle rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary-container drop-shadow-[0_0_5px_rgba(0,255,194,0.4)]">
                      monitoring
                    </span>
                    <h3 className="font-label-caps text-[11px] text-text-muted font-bold tracking-widest">
                      GLOBAL THREAT PULSE
                    </h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,255,194,0.8)]" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col">
                    <span className="font-mono text-[9px] text-text-muted font-bold tracking-wider">TOTAL VALUE AT RISK</span>
                    <span className="font-display-lg text-sm text-primary-container font-extrabold mt-0.5">$4,821,900</span>
                    <span className="text-[8px] font-mono text-text-muted/60 mt-0.5">Across monitored pools</span>
                  </div>

                  <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col">
                    <span className="font-mono text-[9px] text-text-muted font-bold tracking-wider">THREATS BLOCKED</span>
                    <span className="font-display-lg text-sm text-alert-critical font-extrabold mt-0.5">189 Today</span>
                    <span className="text-[8px] font-mono text-primary-container mt-0.5 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">trending_up</span> +14.2% 24h
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col">
                    <span className="font-mono text-[9px] text-text-muted font-bold tracking-wider">MEAN LATENCY</span>
                    <span className="font-display-lg text-sm text-secondary font-extrabold mt-0.5">1.84s</span>
                    <span className="text-[8px] font-mono text-text-muted/60 mt-0.5">Studionet consensus</span>
                  </div>

                  <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/50 flex flex-col">
                    <span className="font-mono text-[9px] text-text-muted font-bold tracking-wider">ACTIVE NODES</span>
                    <span className="font-display-lg text-sm text-on-surface font-extrabold mt-0.5">1,402 Set</span>
                    <span className="text-[8px] font-mono text-primary-container mt-0.5">99.4% Quorum</span>
                  </div>
                </div>

                <div className="p-2 rounded bg-surface-container-highest/30 border border-border-subtle/50 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-text-muted">GENLAYER EPOCH:</span>
                  <span className="text-primary-container font-bold">#418,293 (FINALIZED)</span>
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

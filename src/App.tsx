import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Shield, AlertCircle, Cpu, Activity, Database, CheckCircle2 } from 'lucide-react'
import { useGenLayer } from '@/hooks/useGenLayer'
import { CONTRACT } from '@/lib/genlayer'
import { useWallet } from '@/hooks/useWallet'
import { TokenInput } from '@/components/TokenInput'
import { VerdictCard } from '@/components/VerdictCard'
import { RiskFlags } from '@/components/RiskFlags'
import { WalletConnect } from '@/components/WalletConnect'
import type { ScanResult } from '@/types'

const fmt = (addr: string) => !addr ? '' : addr.length <= 13 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`

const CONSENSUS_PIPELINE = [
  { stage: '01', name: 'Mempool & Ingestion', desc: 'Non-deterministic web intake', key: 'pending' },
  { stage: '02', name: 'Leader Proposal',     desc: 'Deterministic AST bytecode execution', key: 'proposing' },
  { stage: '03', name: 'Commit Phase',        desc: 'Cryptographic hash commitment', key: 'committing' },
  { stage: '04', name: 'Vote Revelation',     desc: 'Byzantine majority agreement', key: 'revealing' },
  { stage: '05', name: 'Finalization',        desc: 'Contract state commit & verification', key: 'accepted' },
] as const

export default function App() {
  const { scanState, scanToken, reset, connectionError } = useGenLayer()
  const { wallet, connect, disconnect } = useWallet()

  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [viewingScan, setViewingScan] = useState<ScanResult | null>(null)
  const [copiedAddr, setCopiedAddr] = useState(false)
  const lastFinalizedRef = useRef<string | null>(null)

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

  const riskyScans = recentScans.filter(s => s.verdict === 'SCAM' || s.verdict === 'RISKY')

  // Trigger real scan with wallet connection
  async function handleScan(tokenAddress: string, chainId: string) {
    if (busy) return
    setViewingScan(null)

    if (!wallet.address) {
      try {
        await connect()
      } catch (e) {
        console.error('Connection request failed:', e)
        return
      }
    }

    const currentWallet = wallet.address || ((window.ethereum as unknown as { selectedAddress?: string })?.selectedAddress) || ''
    await scanToken(tokenAddress, chainId, currentWallet)
  }

  // Active status badge
  const currentUiState = !wallet.address
    ? 'CONNECT WALLET'
    : scanState.status === 'idle'
    ? 'READY'
    : scanState.status === 'submitting'
    ? 'SUBMITTING'
    : scanState.status === 'pending'
    ? 'PENDING'
    : scanState.status === 'proposing'
    ? 'PROPOSING'
    : scanState.status === 'committing'
    ? 'COMMITTING'
    : scanState.status === 'revealing'
    ? 'REVEALING'
    : scanState.status === 'accepted'
    ? 'ACCEPTED'
    : scanState.status === 'finalized'
    ? 'VERIFIED'
    : 'ERROR'

  const copyContractAddr = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT)
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen w-full bg-mesh-canvas text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* ── TOP LUXURY NAVIGATION BAR ── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8 py-3.5 flex justify-center">
        <div className="w-full max-w-[1720px] flex items-center justify-between gap-4">
          {/* Brand identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-cyan-500/30 p-0.5 bg-slate-900 shadow-[0_0_16px_rgba(0,242,254,0.25)] flex-shrink-0">
              <img src="/logo.jpg" alt="ScamShield Logo" className="w-full h-full object-cover rounded-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm tracking-wider text-white">
                  SCAM<span className="text-cyan-400">SHIELD</span>
                </span>
                <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">
                  AI
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-300">
                  <span className={`w-1.5 h-1.5 rounded-full ${busy ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {currentUiState}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 hidden sm:block">
                GenLayer Intelligent Contract Security Oracle
              </p>
            </div>
          </div>

          {/* Real Network Telemetry & Wallet Header Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 text-xs font-mono border-r border-slate-800 pr-4">
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Network</div>
                <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Studionet (61999)
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Consensus</div>
                <div className="text-slate-200 font-semibold">BFT Multi-Agent</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Session History</div>
                <div className="text-slate-200 font-semibold">{recentScans.length} Scanned • {riskyScans.length} Flagged</div>
              </div>
            </div>

            <WalletConnect wallet={wallet} onConnect={connect} onDisconnect={disconnect} />
          </div>
        </div>
      </header>

      {/* ── ERROR NOTIFICATION BANNER ── */}
      <AnimatePresence>
        {(scanState.error || connectionError) && (
          <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300 font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{scanState.error || connectionError}</span>
            </div>
            <button
              onClick={() => reset()}
              className="text-[10px] uppercase font-bold text-rose-400 hover:text-rose-200 p-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* ── MAIN RESPONSIVE SECURITY CANVAS ── */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8 dashboard-grid">
        
        {/* ── LEFT PANEL: SEARCH CONSOLE & SESSION LOGS ── */}
        <div className="flex flex-col gap-6 w-full">
          {/* Main Input Card */}
          <div className="glass-card shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <TokenInput
              onScan={handleScan}
              status={scanState.status}
              onReset={() => { reset(); setViewingScan(null) }}
            />
          </div>

          {/* Session Scan History Card */}
          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  Session Scans ({recentScans.length})
                </h3>
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase">Local Cache</span>
            </div>

            {recentScans.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/40">
                No session scans yet. Run a contract analysis above.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {recentScans.map((s, idx) => {
                  const bad = s.verdict === 'SCAM' || s.verdict === 'RISKY'
                  const unk = s.verdict === 'UNKNOWN'
                  const badgeColor = bad ? 'text-rose-400 bg-rose-950/40 border-rose-500/30' : unk ? 'text-amber-400 bg-amber-950/40 border-amber-500/30' : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
                  const active = currentResult?.tokenAddress.toLowerCase() === s.tokenAddress.toLowerCase()

                  return (
                    <button
                      key={idx}
                      onClick={() => setViewingScan(s)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_16px_rgba(0,242,254,0.1)]'
                          : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-xs text-white truncate">
                            {s.realTokenData?.name || s.tokenIdentity?.name || 'Unknown Asset'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({s.realTokenData?.symbol || s.tokenIdentity?.symbol || '?'})
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                          {fmt(s.tokenAddress)} • {s.chainId.toUpperCase()}
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${badgeColor}`}>
                        {s.verdict}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER PANEL: SCAN DOSSIER & CONSENSUS RESULTS ── */}
        <div className="flex flex-col gap-6 w-full">
          {/* Case 1: Scanning in Progress */}
          {busy && (
            <div className="glass-card p-8 text-center flex flex-col items-center justify-center min-h-[380px]">
              <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-dashed border-cyan-400 animate-spin-slow" />
                <Cpu className="w-10 h-10 text-cyan-400 animate-pulse" />
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 mb-3 animate-pulse">
                VALIDATORS EXECUTING CONSENSUS
              </span>

              <h3 className="font-display font-bold text-lg text-white mb-2">
                Analyzing Intelligent Contract Code
              </h3>
              <p className="text-xs text-slate-400 font-sans max-w-sm mb-4">
                GenLayer validator nodes are non-deterministically retrieving external provider security evidence and achieving Byzantine agreement.
              </p>

              {scanState.txHash && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span>Tx:</span>
                  <span className="text-cyan-400 font-bold">{fmt(scanState.txHash)}</span>
                </div>
              )}
            </div>
          )}

          {/* Case 2: Finalized Result Dossier */}
          {currentResult && !busy && (
            <div className="flex flex-col gap-6">
              {/* Verdict Card */}
              <VerdictCard result={currentResult} />

              {/* Authoritative Market & Identity Telemetry */}
              {(() => {
                const rt = currentResult.realTokenData
                const price = rt?.price ? `$${rt.price < 0.0001 ? rt.price.toExponential(2) : rt.price.toFixed(4)}` : 'N/A'
                const liq   = rt?.liquidity != null ? `$${Math.round(rt.liquidity).toLocaleString()}` : 'N/A'
                const fdv   = rt?.fdv != null ? `$${Math.round(rt.fdv).toLocaleString()}` : 'N/A'
                const sup   = rt?.totalSupply || 'N/A'
                const buyT  = rt?.buyTax ? `${rt.buyTax}%` : '0%'
                const sellT = rt?.sellTax ? `${rt.sellTax}%` : '0%'

                return (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                          On-Chain Contract Metrics
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Provider Verified</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'PRICE', value: price, desc: 'Market Price' },
                        { label: 'LIQUIDITY', value: liq, desc: 'DEX Liquidity' },
                        { label: 'FDV', value: fdv, desc: 'Fully Diluted Val' },
                        { label: 'TOTAL SUPPLY', value: sup, desc: 'Circulating Supply' },
                        { label: 'BUY TAX', value: buyT, desc: 'Purchase Fee' },
                        { label: 'SELL TAX', value: sellT, desc: 'Disposal Fee' },
                      ].map((item, i) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                          <div className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider">{item.label}</div>
                          <div className="text-sm font-mono font-bold text-white mt-0.5 truncate" title={item.value}>{item.value}</div>
                          <div className="text-[8px] font-sans text-slate-600 mt-0.5">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Risk Flags */}
              <RiskFlags flags={currentResult.flags} />

              {/* Authentic GenLayer Validator Committee */}
              {currentResult.validatorVotes && currentResult.validatorVotes.length > 0 && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                        GenLayer Validator Committee ({currentResult.validatorVotes.length} Nodes)
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 uppercase">
                      {currentResult.telemetry?.resultName || 'CONSENSUS VERIFIED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {currentResult.validatorVotes.map((v, i) => {
                      const bad = v.vote === 'SCAM' || v.vote === 'RISKY'
                      const col = bad ? 'text-rose-400' : 'text-cyan-400'

                      return (
                        <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-500 font-bold">Node #{i + 1}</span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-800/40 text-cyan-300">
                              {v.voteName || 'AGREE'}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-300 truncate" title={v.validatorAddress}>
                            {fmt(v.validatorAddress)}
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-[10px] font-mono font-bold">
                            <span className={col}>{v.vote}</span>
                            <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> VERIFIED
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Case 3: Idle / Standby Screen (Command Center Hero) */}
          {!busy && !currentResult && (
            <div className="glass-card p-6 sm:p-8 flex flex-col items-center justify-between min-h-[560px] text-center">
              <div className="flex flex-col items-center w-full max-w-lg">
                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-spin-slow" />
                  <div className="absolute inset-2 rounded-full border border-dashed border-cyan-400/40 animate-pulse-glow" />
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_24px_rgba(0,242,254,0.2)]">
                    <Shield className="w-8 h-8 text-cyan-300" />
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  SYSTEM STANDBY • READY FOR ANALYSIS
                </div>

                <h3 className="font-display font-black text-2xl text-white mb-2 tracking-wide">
                  Decentralized Threat Intelligence
                </h3>
                <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
                  Broadcast any smart contract address on Ethereum, BSC, Solana, or Layer-2s to trigger decentralized multi-agent Byzantine consensus directly across GenLayer validator nodes.
                </p>
              </div>

              {/* 3 Core Architecture Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left font-sans">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all">
                  <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Byzantine AI
                  </div>
                  <div className="text-xs font-bold text-white mb-1">5-Node BFT Committee</div>
                  <div className="text-[10px] text-slate-400 leading-normal">Independent validator nodes evaluate AST bytecode without centralized oracle risk.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all">
                  <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Chain-Bounded
                  </div>
                  <div className="text-xs font-bold text-white mb-1">Strict Evidence Filter</div>
                  <div className="text-[10px] text-slate-400 leading-normal">Rejects out-of-chain token data. Never substitutes cross-chain metadata or phantom pairs.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all">
                  <div className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Equivalence Principle
                  </div>
                  <div className="text-xs font-bold text-white mb-1">Material Field Agreement</div>
                  <div className="text-[10px] text-slate-400 leading-normal">Validators must agree on token identity, verdict, risk bracket, and core threat drivers.</div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="w-full mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-slate-500">Intelligent Contract:</span>
                  <span className="font-bold text-slate-200">{fmt(CONTRACT)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 font-bold">GenLayer Studio Net Verified</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: CONSENSUS ENGINE PIPELINE & ARCHITECTURE ── */}
        <div className="flex flex-col gap-6 w-full">
          <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  AI Consensus Engine
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                busy ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 animate-pulse' : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                {busy ? 'Running' : currentResult ? 'Finalized' : 'Standby'}
              </span>
            </div>

            {/* 5 Consensus Stages */}
            <div className="flex flex-col gap-2">
              {CONSENSUS_PIPELINE.map((s, idx) => {
                let statusLabel = 'STANDBY'
                let badgeStyle = 'bg-slate-900/60 text-slate-500 border-slate-800/60'
                let numColor = 'text-slate-600'
                let titleColor = 'text-slate-400'
                let containerClass = 'opacity-60 bg-slate-950/30 border-slate-900/60'

                if (busy) {
                  let currentIdx = 0
                  if (scanState.status === 'proposing') currentIdx = 1
                  else if (scanState.status === 'committing') currentIdx = 2
                  else if (scanState.status === 'revealing') currentIdx = 3
                  else if (scanState.status === 'accepted') currentIdx = 4

                  if (idx < currentIdx) {
                    statusLabel = 'DONE'
                    badgeStyle = 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                    numColor = 'text-emerald-400'
                    titleColor = 'text-slate-300'
                    containerClass = 'bg-slate-950/50 border-slate-800/60'
                  } else if (idx === currentIdx) {
                    statusLabel = 'RUNNING'
                    badgeStyle = 'bg-cyan-950/50 text-cyan-400 border-cyan-500/40 animate-pulse'
                    numColor = 'text-cyan-400'
                    titleColor = 'text-white font-bold'
                    containerClass = 'bg-cyan-950/15 border-cyan-500/30'
                  } else {
                    statusLabel = 'QUEUED'
                    badgeStyle = 'bg-slate-900/40 text-slate-600 border-slate-800/40'
                    numColor = 'text-slate-600'
                    titleColor = 'text-slate-500'
                    containerClass = 'bg-slate-950/20 border-slate-900/40'
                  }
                } else if (currentResult) {
                  statusLabel = 'VERIFIED'
                  badgeStyle = 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  numColor = 'text-emerald-400'
                  titleColor = 'text-slate-200'
                  containerClass = 'bg-slate-950/60 border-slate-800/80'
                }

                return (
                  <div
                    key={s.stage}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${containerClass}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`font-mono text-xs font-bold ${numColor}`}>{s.stage}</span>
                      <div className="truncate">
                        <div className={`text-xs font-sans truncate ${titleColor}`}>{s.name}</div>
                        <div className="text-[9px] font-mono text-slate-500 truncate">{s.desc}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${badgeStyle}`}>
                      {statusLabel}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Architecture specification */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 text-[11px] font-sans text-slate-400 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Intelligent Contract:</span>
                <button
                  onClick={copyContractAddr}
                  className="font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  title={CONTRACT}
                >
                  {fmt(CONTRACT)}
                  {copiedAddr ? <span className="text-[9px] text-emerald-400">COPIED</span> : null}
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Consensus Model:</span>
                <span className="font-mono text-slate-300">Material Equivalence</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Chain Scope:</span>
                <span className="font-mono text-slate-300">Strict Bounded</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 px-6 py-4 mt-auto text-xs font-mono text-slate-500 flex justify-center">
        <div className="w-full max-w-[1720px] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            ScamShield AI • Powered by GenLayer Intelligent Contracts & Decentralized Validators
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              GenLayer Studio
            </a>
            <span>•</span>
            <a
              href="https://github.com/YousufAziz1/scamshield"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

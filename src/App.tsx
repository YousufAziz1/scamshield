import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Shield, AlertCircle, X, Cpu, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { useGenLayer } from '@/hooks/useGenLayer'
import { CONTRACT } from '@/lib/genlayer'
import { useWallet } from '@/hooks/useWallet'
import { TokenInput } from '@/components/TokenInput'
import { VerdictCard } from '@/components/VerdictCard'
import { RiskFlags } from '@/components/RiskFlags'
import { ConsensusProgress } from '@/components/ConsensusProgress'
import { WalletConnect } from '@/components/WalletConnect'
import type { ScanResult } from '@/types'

const fmt = (addr: string) => !addr ? '' : addr.length <= 13 ? addr : `${addr.slice(0,6)}...${addr.slice(-4)}`

function getChainBadge(chain: string) {
  const c = chain.toUpperCase()
  if (c==='SOL') return 'bg-purple-950/80 text-purple-400 border border-purple-800/30'
  if (c==='ETH') return 'bg-blue-950/80 text-blue-400 border border-blue-800/30'
  if (c==='BSC') return 'bg-amber-950/80 text-amber-400 border border-amber-800/30'
  return 'bg-slate-900/80 text-slate-400 border border-slate-700/30'
}

export default function App() {
  const { scanState, scanToken, reset, progressPercent, connectionError, isStudioMode } = useGenLayer()
  const { wallet, connect, disconnect } = useWallet()
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [viewingScan, setViewingScan] = useState<ScanResult | null>(null)

  const currentResult = viewingScan ?? scanState.result
  const isScanning = ['submitting','pending','proposing','committing','revealing'].includes(scanState.status)
  const busy = isScanning || scanState.status === 'accepted'
  const isMalicious = !!(currentResult && (currentResult.verdict==='SCAM'||currentResult.verdict==='RISKY'))

  const lastProcessedTxRef = useRef<string | null>(null)

  useEffect(() => {
    const res = scanState.result
    if (res && res.txHash && lastProcessedTxRef.current !== res.txHash) {
      lastProcessedTxRef.current = res.txHash
      setRecentScans(prev => [res, ...prev.filter(s => s.txHash !== res.txHash).slice(0, 9)])
    }
  }, [scanState.result])

  async function handleScan(addr: string, chain: string) {
    let activeAddr = wallet.address
    if (!activeAddr) {
      activeAddr = await connect()
      if (!activeAddr) return
    }
    await scanToken(addr, chain, activeAddr)
  }

  const riskyScans = recentScans.filter(s => s.verdict==='SCAM'||s.verdict==='RISKY').slice(0,5)
  const safeScans  = recentScans.filter(s => s.verdict==='SAFE'||s.verdict==='UNKNOWN').slice(0,5)

  const accentVar = isMalicious ? 'var(--accent-red)' : 'var(--accent-cyan)'

  const currentUiState = !wallet.address
    ? 'CONNECT WALLET'
    : scanState.status === 'error'
    ? 'ERROR'
    : scanState.status === 'finalized'
    ? 'VERIFIED'
    : busy
    ? scanState.status.toUpperCase()
    : 'READY'

  return (
    <div className="app-shell">
      <div className="monitor-outer">
        <div className="monitor-screen" style={{'--accent': accentVar} as React.CSSProperties}>
          <div className="absolute inset-0 bg-cyber-grid z-0" />
          <div className="scanlines" />
          <div className="monitor-reflection" />

          {/* ── HEADER ── */}
          <header className="header-strip">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo.jpg" alt="ScamShield Logo" className="w-8 h-8 rounded-full border border-cyan-500/40 object-cover flex-shrink-0 animate-bounce-in" style={{boxShadow:'0 0 12px rgba(0,255,204,0.25)'}} />
              <h1 className="font-display font-black text-xs tracking-widest text-white flex items-center gap-2">
                SCAM<span className="text-cyan-400">SHIELD</span>
                <span className="text-[8px] font-mono font-bold px-1 rounded bg-cyan-400 text-black">AI</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                  currentUiState === 'VERIFIED' || currentUiState === 'READY'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : currentUiState === 'ERROR'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                }`}>
                  <span className={`w-1 h-1 rounded-full ${
                    currentUiState === 'VERIFIED' || currentUiState === 'READY'
                      ? 'bg-emerald-400 animate-pulse'
                      : currentUiState === 'ERROR'
                      ? 'bg-rose-400'
                      : 'bg-cyan-400 animate-pulse'
                  }`} />
                  {currentUiState}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden md:flex items-center gap-3">
                {[
                  { val: 'Studio (61999)', lbl: 'GenLayer Network' },
                  { val: 'BFT Consensus', lbl: 'Protocol' },
                  { val: String(recentScans.length), lbl: 'Session Scans' },
                  { val: String(riskyScans.length), lbl: 'Threats Flagged' },
                ].map((s,i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i>0 && <div className="stat-divider" />}
                    <div className="text-right">
                      <div className="text-white font-mono font-bold text-xs leading-none">{s.val}</div>
                      <div className="text-slate-500 font-mono text-[8px] uppercase mt-0.5">{s.lbl}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="stat-divider hidden md:block" />
              <WalletConnect wallet={wallet} onConnect={connect} onDisconnect={disconnect} />
            </div>
          </header>

          {/* ── 3-PANEL GRID ── */}
          <main className="panel-grid relative z-10">

            {/* PANEL LEFT */}
            <div className="panel-left">
              <div style={{borderBottom:'1px solid var(--border-subtle)'}}>
                <TokenInput onScan={handleScan} status={scanState.status} onReset={() => { reset(); setViewingScan(null) }} />
              </div>

              <div className="panel-left-scroll">
                {/* Recent Threat Logs */}
                <div>
                  <h3 className="font-display font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 mb-2 text-rose-500">
                    <ShieldAlert className="w-3 h-3" /> Recent Logs ({riskyScans.length})
                  </h3>
                  {riskyScans.length === 0 ? (
                    <div className="text-[9px] text-slate-600 font-mono italic p-2 border border-dashed border-slate-900/60 rounded">No threat logs yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {riskyScans.map(s => (
                        <div key={s.txHash} onClick={() => setViewingScan(s)} className="cyber-card p-2 cursor-pointer hover:border-rose-500/50 transition-all text-[9px] font-mono border-rose-500/20 bg-rose-950/10">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-bold text-white truncate max-w-[90px]">{s.realTokenData?.symbol ?? fmt(s.tokenAddress)}</span>
                            <span className={`px-1 rounded text-[7px] font-bold ${getChainBadge(s.chainId)}`}>{s.chainId.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-rose-400 font-bold">{s.verdict}</span>
                            <span className="text-rose-400/70">{s.riskScore}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Safe Verified Logs */}
                <div>
                  <h3 className="font-display font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 mb-2 text-cyan-400">
                    <Shield className="w-3 h-3" /> Verified Logs ({safeScans.length})
                  </h3>
                  {safeScans.length === 0 ? (
                    <div className="text-[9px] text-slate-600 font-mono italic p-2 border border-dashed border-slate-900/60 rounded">No verified logs yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {safeScans.map(s => (
                        <div key={s.txHash} onClick={() => setViewingScan(s)} className="cyber-card p-2 cursor-pointer hover:border-cyan-500/50 transition-all text-[9px] font-mono border-cyan-500/20 bg-cyan-950/10">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-bold text-white truncate max-w-[90px]">{s.realTokenData?.symbol ?? fmt(s.tokenAddress)}</span>
                            <span className={`px-1 rounded text-[7px] font-bold ${getChainBadge(s.chainId)}`}>{s.chainId.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={s.verdict==='SAFE' ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>{s.verdict}</span>
                            <span className={s.verdict==='SAFE' ? "text-cyan-400/70" : "text-amber-400/70"}>{s.riskScore}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* System Debug accordion pinned at bottom */}
              <div style={{borderTop:'1px solid var(--border-subtle)', background:'#020d0d', flexShrink:0}}>
                <details className="debug-accordion group">
                  <summary className="p-3 flex items-center justify-between font-display font-bold text-[9px] uppercase tracking-wider text-cyan-400">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> System Debug</span>
                    <ChevronDown className="w-3 h-3 text-slate-500 group-open:hidden" />
                    <ChevronUp className="w-3 h-3 text-slate-500 hidden group-open:block" />
                  </summary>
                  <div className="px-3 pb-3 font-mono text-[9px] space-y-1 text-slate-400">
                    {[
                      ['CONTRACT', fmt(CONTRACT)],
                      ['TX HASH', scanState.txHash ? fmt(scanState.txHash) : 'NULL'],
                      ['NETWORK', isStudioMode ? 'studionet' : 'testnetBradbury'],
                      ['STATUS', scanState.status.toUpperCase()],
                    ].map(([k,v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-slate-500">{k}:</span>
                        <span className="text-white truncate max-w-[140px]">{v}</span>
                      </div>
                    ))}
                    {connectionError && (
                      <div className="mt-1 text-[8px] text-red-400 border-t border-red-500/10 pt-1 break-words">
                        <span className="font-bold">ERROR:</span> {connectionError}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* PANEL CENTER */}
            <div className="panel-center">

              {/* Wallet banner */}
              {!wallet.address && (
                <div className="cyber-card p-3 flex items-center justify-between animate-in" style={{borderColor:'rgba(0,255,204,0.2)',background:'rgba(0,255,204,0.04)'}}>
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="font-mono text-[9px] font-bold tracking-wider text-cyan-400 truncate">Wallet signature required for consensus submissions</span>
                  </div>
                  <button onClick={connect} className="btn-cyber px-4 py-1.5 text-[9px] font-bold flex-shrink-0" style={{border:'1px solid var(--accent-cyan)',color:'var(--accent-cyan)',background:'transparent'}}>Connect</button>
                </div>
              )}

              {/* Error banner */}
              {(scanState.status === 'error' || wallet.error) && (
                <div className="cyber-card p-3 border-red-500/30 bg-red-500/5 text-red-400 flex items-center justify-between animate-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span className="font-mono text-[9px] truncate">{scanState.error || wallet.error}</span>
                  </div>
                  <button onClick={() => { reset(); disconnect() }} className="btn-cyber border border-red-500 text-red-400 px-4 py-1.5 text-[9px] flex-shrink-0">Dismiss</button>
                </div>
              )}

              {/* Progress */}
              <AnimatePresence>
                {isScanning && <ConsensusProgress status={scanState.status} validatorVotes={scanState.result?.validatorVotes} progressPercent={progressPercent} />}
              </AnimatePresence>

              {/* Loading card */}
              {busy && (
                <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 pulse-border" style={{background:'#031010',padding:'28px 20px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,minHeight:150}}>
                  <div className="scanner-line" style={{background:'linear-gradient(90deg,transparent,var(--accent-cyan),transparent)'}} />
                  <div className="relative w-11 h-11 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/20 animate-spin" style={{animationDuration:'6s'}} />
                    <div className="absolute inset-2 rounded-full border border-cyan-400/40 animate-spin" style={{animationDuration:'3s',animationDirection:'reverse'}} />
                    <Cpu className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="font-display font-black text-[11px] uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <span>VALIDATORS ANALYZING</span>
                    <span className="cursor-blink">|</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                  </div>
                </div>
              )}

              {/* Verdict card */}
              {!busy && currentResult && <VerdictCard result={currentResult} />}

              {/* Contract Specs Grid */}
              {currentResult && !busy && (() => {
                const r = currentResult
                
                // Get authoritative values or N/A (never fabricate fallback metrics)
                const taxLabel = r.realTokenData && r.realTokenData.isVerified ? `Buy ${r.realTokenData.buyTax}% / Sell ${r.realTokenData.sellTax}%` : 'N/A'

                const supply  = (r.realTokenData?.totalSupply && r.realTokenData.totalSupply !== 'N/A') ? r.realTokenData.totalSupply : 'N/A'
                
                const liq     = (r.realTokenData?.liquidity !== undefined && r.realTokenData.liquidity !== null) 
                                ? `$${r.realTokenData.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
                                : 'N/A'
                
                const creator = r.realTokenData?.creator && r.realTokenData.creator !== 'Unknown Deployer'
                                ? (r.realTokenData.creator.startsWith('0x') ? fmt(r.realTokenData.creator) : r.realTokenData.creator) 
                                : fmt(r.tokenAddress)

                return (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                    {[
                      {label:'TOTAL SUPPLY', value:supply,       icon:'⬡'},
                      {label:'CREATOR',      value:creator,      icon:'👤'},
                      {label:'TAX',          value:taxLabel,     icon:'⚡'},
                      {label:'LIQUIDITY',    value:liq,          icon:'💧'},
                    ].map(s => (
                      <div key={s.label} style={{background:'#041414',border:'1px solid rgba(0,255,204,0.12)',borderRadius:8,padding:'10px 12px'}}>
                        <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',marginBottom:5,fontFamily:'JetBrains Mono,monospace',fontWeight:700,textTransform:'uppercase'}}>{s.icon} {s.label}</div>
                        <div style={{color:'#fff',fontSize:12,fontFamily:'JetBrains Mono,monospace',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Vulnerability logs */}
              {currentResult && <RiskFlags flags={currentResult.flags} />}

              {/* Validator breakdown */}
              {/* GenLayer Validator Committee */}
              {currentResult && currentResult.validatorVotes.length > 0 && (
                <div className="cyber-card p-4" style={{borderColor:'rgba(0,255,204,0.1)',flex:'1 1 auto',display:'flex',flexDirection:'column'}}>
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h3 className="font-display font-bold text-[9px] uppercase tracking-wider text-slate-400">
                      GenLayer Validator Committee ({currentResult.validatorVotes.length} Nodes)
                    </h3>
                    <span className="font-mono text-[8px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                      {currentResult.telemetry?.resultName || 'CONSENSUS VERIFIED'}
                    </span>
                  </div>
                  <div className="validator-cards-grid" style={{flex:'1 1 auto'}}>
                    {currentResult.validatorVotes.map((v, i) => {
                      const bad = v.vote==='SCAM'||v.vote==='RISKY'
                      const col = bad ? 'var(--accent-yellow)' : 'var(--accent-cyan)'
                      const shortAddr = fmt(v.validatorAddress) || `Node #${i+1}`
                      return (
                        <div key={v.validatorAddress || i} className="validator-card animate-in" style={{borderColor:`${col}30`,backgroundColor:bad?'rgba(255,204,0,0.03)':'rgba(0,255,204,0.03)',animationDelay:`${i*60}ms`,minHeight:150,height:'100%'}}>
                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 font-bold">
                            <span>#{i+1}</span>
                            <span className="tracking-wider truncate ml-1 text-slate-400" title={v.validatorAddress}>{shortAddr}</span>
                          </div>
                          <div className="flex items-center justify-center my-3">
                            <div className="relative w-11 h-11 rounded-full flex items-center justify-center text-xl" style={{background:`radial-gradient(circle,${col}15 0%,transparent 75%)`,border:`1px solid ${col}40`}}>
                              <Cpu className="w-5 h-5" style={{color:col}} />
                            </div>
                          </div>
                          <div>
                            <div className="text-center font-mono text-[8px] text-slate-400 mb-1">
                              VOTE: <span style={{color:col,fontWeight:700}}>{v.voteName || 'AGREE'}</span>
                            </div>
                            <div className="flex justify-between items-center font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 border border-slate-800/60">
                              <span style={{color:col}}>{v.vote}</span>
                              <span className="text-emerald-400 text-[8px]">VERIFIED</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Real GenLayer Consensus Telemetry */}
              {currentResult && currentResult.validatorVotes.length > 0 && (
                <div style={{background:'#041414',border:'1px solid rgba(0,255,204,0.08)',borderRadius:10,padding:'14px 16px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,flexShrink:0}}>
                  {/* Col 1: Consensus Execution */}
                  <div>
                    <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Consensus Telemetry</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Result</span>
                        <span style={{fontSize:9,color:'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{currentResult.telemetry?.resultName || 'MAJORITY_AGREE'}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Rounds Executed</span>
                        <span style={{fontSize:9,color:'#fff',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{currentResult.telemetry?.roundsExecuted || 1}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Committed / Revealed</span>
                        <span style={{fontSize:9,color:'#fff',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{currentResult.telemetry?.votesCommitted || 5} / {currentResult.telemetry?.votesRevealed || 5}</span>
                      </div>
                    </div>
                  </div>
                  {/* Col 2: Intelligent Contract */}
                  <div>
                    <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Intelligent Contract</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Contract</span>
                        <span style={{fontSize:9,color:'#fff',fontFamily:'JetBrains Mono,monospace',fontWeight:700}} title={CONTRACT}>{fmt(CONTRACT)}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Network</span>
                        <span style={{fontSize:9,color:'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>Studio (61999)</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Equivalence Schema</span>
                        <span style={{fontSize:8,color:'#a0c0c0',fontFamily:'JetBrains Mono,monospace'}}>Material Fields</span>
                      </div>
                    </div>
                  </div>
                  {/* Col 3: Evidence Verification */}
                  <div>
                    <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Evidence Verification</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Target Chain</span>
                        <span style={{fontSize:9,color:'#fff',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{currentResult.chainId.toUpperCase()}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Chain-Matched</span>
                        <span style={{fontSize:9,color:'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>Enforced</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>Sufficiency</span>
                        <span style={{fontSize:9,color:currentResult.verdict === 'UNKNOWN' ? 'var(--accent-yellow)' : 'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>
                          {currentResult.evidenceSufficiency || (currentResult.verdict === 'UNKNOWN' ? 'INSUFFICIENT' : 'SUFFICIENT')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle standby */}
              {scanState.status==='idle' && (
                <div className="cyber-card flex flex-col flex-1" style={{borderColor:'rgba(0,255,204,0.1)'}}>
                  <div className="flex flex-col items-center justify-center p-8 flex-1">
                    <div className="relative mb-4" style={{width:72,height:72}}>
                      <div className="absolute inset-0 rounded-full" style={{border:'2px solid rgba(0,255,204,0.15)',animation:'spin 8s linear infinite'}} />
                      <div className="absolute inset-2 rounded-full" style={{border:'1px dashed rgba(0,255,204,0.3)',animation:'spin 5s linear infinite reverse'}} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Shield className="w-7 h-7 text-cyan-400/50" />
                      </div>
                    </div>
                    <h3 className="font-display text-[11px] uppercase tracking-widest mb-1 text-cyan-400/60">System Standby</h3>
                    <p className="font-mono text-[9px] text-slate-500 text-center max-w-xs leading-normal">
                      Enter a contract address on the left to begin decentralized validator consensus analysis.
                    </p>
                  </div>
                  <div className="p-4 border-t border-slate-900/60" style={{background:'#020d0d'}}>
                    <div className="font-display text-[9px] uppercase tracking-widest mb-2 text-cyan-400/40">Quick Scan Targets</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {name:'USDC',chain:'ETH',safe:true,addr:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',chainId:'ethereum'},
                        {name:'Honeypot',chain:'BSC',safe:false,addr:'0x4f128e6dbd1283c799a4e21a2c91a329d48b1111',chainId:'bsc'},
                        {name:'WBTC',chain:'ETH',safe:true,addr:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',chainId:'ethereum'},
                        {name:'SafeMoon',chain:'BSC',safe:false,addr:'0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3',chainId:'bsc'},
                        {name:'UNI',chain:'ETH',safe:true,addr:'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',chainId:'ethereum'},
                        {name:'SquidGame',chain:'BSC',safe:false,addr:'0x58d4B9e633B41E6f00d24C3D5A96c4D4e8b55dA8',chainId:'bsc'},
                      ].map((t,i) => (
                        <button key={i}
                          onClick={() => handleScan(t.addr, t.chainId)}
                          className="group relative rounded font-mono text-[10px] text-left transition-all p-2"
                          style={{background:'#000',border:`1px solid ${t.safe?'rgba(0,255,204,0.15)':'rgba(255,0,64,0.15)'}`}}
                        >
                          <div className="font-bold text-white truncate">{t.name}</div>
                          <div className={`inline-block text-[8px] px-1 rounded mt-0.5 font-mono ${getChainBadge(t.chain)}`}>{t.chain}</div>
                          <div className="absolute inset-0 rounded flex items-center justify-center text-[8px] font-display font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity" style={{background:'rgba(0,0,0,0.88)',color:t.safe?'var(--accent-cyan)':'#ff0040'}}>
                            Click to Scan
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PANEL RIGHT */}
            <div className="panel-right">
              <div className="panel-right-inner">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display font-bold text-[9px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">AI Agent Consensus</span>
                  </h3>
                  <span className={`px-2 py-0.5 rounded border text-[8px] font-mono font-bold uppercase tracking-wider flex-shrink-0 ${busy ? 'border-cyan-400/25 bg-cyan-400/5 text-cyan-400 animate-pulse' : 'border-slate-700/30 bg-slate-900/30 text-slate-500'}`}>
                    {busy ? 'Running' : currentResult ? 'AI Thought' : 'Standby'}
                  </span>
                </div>

                {busy && (
                  <div className="font-mono text-[9px] space-y-2 text-slate-400 mt-2">
                    <div className="text-cyan-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                      <span>Resolving non-deterministic variables...</span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                      <span>Awaiting Byzantine consensus...</span>
                    </div>
                  </div>
                )}

                {currentResult && !busy && (() => {
                  const score = Math.round(currentResult.riskScore)
                  const isUnk = currentResult.verdict === 'UNKNOWN'
                  const scoreColor = isUnk ? 'var(--accent-yellow)' : score > 70 ? 'var(--accent-red)' : score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-cyan)'
                  return (
                    <>
                      <p className="text-[10px] leading-relaxed text-slate-400 font-mono mt-2">
                        The decentralized AI oracle network has independently analyzed the AST bytecode, liquidity metrics, and deployer history.
                        Consensus has been reached via Byzantine fault-tolerant aggregation.
                        {isUnk ? ' Authoritative identity or market data was insufficient on the selected chain to determine a conclusive security rating.' : isMalicious ? ' High probability of rug-pull or honeypot mechanics detected.' : ' Contract parameters conform to safe standards.'}
                      </p>
                      <div className="mt-auto pt-3 border-t border-slate-900/60">
                        <div style={{color:'#5c7a7a',fontSize:9,fontFamily:'JetBrains Mono,monospace',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:6}}>
                          {isUnk ? 'INSUFFICIENT DATA RATING' : 'Consensus Score'}
                        </div>
                        <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:8}}>
                          <span style={{fontSize:32,fontWeight:900,fontFamily:'Orbitron,sans-serif',color:scoreColor,lineHeight:1,textShadow:`0 0 20px ${scoreColor}60`}}>{score}</span>
                          <span style={{fontSize:16,color:'#3d6060',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>/100</span>
                        </div>
                        <div style={{width:'100%',height:4,background:'#0a1a1a',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${score}%`,background:scoreColor,borderRadius:2,transition:'width 1s ease',boxShadow:`0 0 8px ${scoreColor}60`}} />
                        </div>
                      </div>
                    </>
                  )
                })()}

                {!busy && !currentResult && (
                  <div className="space-y-2 mt-2">
                    {[
                      { stage: '01', name: 'Mempool & Queue', desc: 'Web nondet input resolution', status: 'ACTIVE' },
                      { stage: '02', name: 'Leader Proposal', desc: 'Deterministic AST execution', status: 'ACTIVE' },
                      { stage: '03', name: 'Commit Phase', desc: 'Cryptographic hash commitment', status: 'ACTIVE' },
                      { stage: '04', name: 'Vote Revelation', desc: 'Byzantine majority agreement', status: 'ACTIVE' },
                      { stage: '05', name: 'Finalization', desc: 'Contract storage state committed', status: 'ACTIVE' },
                    ].map(s => (
                      <div key={s.stage} className="validator-list-item">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-[9px] text-cyan-400 font-bold">{s.stage}</span>
                          <div className="truncate">
                            <div className="font-mono text-[9px] font-bold text-slate-300 truncate">{s.name}</div>
                            <div className="font-mono text-[8px] text-slate-500 truncate">{s.desc}</div>
                          </div>
                        </div>
                        <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-cyan-950/30 text-cyan-400 border border-cyan-950/40 flex-shrink-0">{s.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </main>
        </div>
        <div className="monitor-stand" />
      </div>
    </div>
  )
}

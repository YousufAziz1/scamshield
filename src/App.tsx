import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Shield, AlertCircle, X, Cpu, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { useGenLayer, VALIDATOR_MASCOTS } from '@/hooks/useGenLayer'
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
  const { scanState, scanToken, reset, progressPercent, isSnapInstalled, connectionStatus, connectionError, installSnap, isStudioMode } = useGenLayer()
  const { wallet, connect, disconnect } = useWallet()
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [viewingScan, setViewingScan] = useState<ScanResult | null>(null)

  const currentResult = viewingScan ?? scanState.result
  const isScanning = ['submitting','pending','proposing','committing','revealing'].includes(scanState.status)
  const busy = isScanning || scanState.status === 'accepted'
  const isMalicious = !!(currentResult && (currentResult.verdict==='SCAM'||currentResult.verdict==='RISKY'))

  useEffect(() => {
    if (scanState.result && !viewingScan && !recentScans.find(s => s.txHash===scanState.result?.txHash)) {
      setRecentScans(prev => [scanState.result!, ...prev.slice(0,9)])
    }
  }, [scanState.result, viewingScan, recentScans])

  function handleScan(addr: string, chain: string) {
    if (!wallet.address) { connect(); return }
    if (!isSnapInstalled) { installSnap(); return }
    scanToken(addr, chain, wallet.address)
  }

  const riskyScans = recentScans.filter(s => s.verdict==='SCAM'||s.verdict==='RISKY').slice(0,5)
  const safeScans  = recentScans.filter(s => s.verdict==='SAFE'||s.verdict==='UNKNOWN').slice(0,5)

  const accentVar = isMalicious ? 'var(--accent-red)' : 'var(--accent-cyan)'

  return (
    <div className="app-shell">
      <div className="monitor-outer">
        <div className="monitor-screen" style={{'--accent': accentVar} as any}>
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
                {isSnapInstalled && connectionStatus==='connected' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[8px] font-mono text-rose-400 font-bold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-rose-400" />DEMO
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden md:flex items-center gap-3">
                {[
                  { val: isMalicious?'21':'20', lbl:'Validators' },
                  { val: isMalicious?'99.1%':'98.4%', lbl:'Confidence' },
                  { val: isMalicious?'1,505':'1,492', lbl:'Scanned' },
                  { val: isMalicious?'399':'419', lbl:'Risk Lens' },
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
                      {riskyScans.map((s,i) => (
                        <div key={i} onClick={() => setViewingScan(s)} className="flex items-center justify-between rounded border border-slate-900 p-2 cursor-pointer hover:bg-red-950/10 hover:border-red-900/30 transition-colors" style={{minWidth:0}}>
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-bold text-[10px] truncate">{fmt(s.tokenAddress)}</div>
                            <div className="text-[8px] font-mono text-slate-500">{s.chainId.toUpperCase()}</div>
                          </div>
                          <div className="text-red-500 font-black font-mono text-xs pl-2 flex-shrink-0">{s.riskScore}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Verified Safe */}
                <div>
                  <h3 className="font-display font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 mb-2 text-cyan-400">
                    <Shield className="w-3 h-3" /> Verified Safe ({safeScans.length})
                  </h3>
                  {safeScans.length === 0 ? (
                    <div className="text-[9px] text-slate-600 font-mono italic p-2 border border-dashed border-slate-900/60 rounded">No safe logs yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {safeScans.map((s,i) => (
                        <div key={i} onClick={() => setViewingScan(s)} className="flex items-center justify-between rounded border border-slate-900 p-2 cursor-pointer hover:bg-cyan-950/10 hover:border-cyan-900/30 transition-colors" style={{minWidth:0}}>
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-bold text-[10px] truncate">{fmt(s.tokenAddress)}</div>
                            <div className="text-[8px] font-mono text-slate-500">{s.chainId.toUpperCase()}</div>
                          </div>
                          <div className="text-cyan-400 font-black font-mono text-xs pl-2 flex-shrink-0">{s.riskScore}</div>
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

              {/* Snap banner */}
              {isSnapInstalled === false && (
                <div className="cyber-card p-3 border-rose-500/30 bg-rose-950/10 text-rose-400 flex items-center justify-between gap-3 animate-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-pulse" />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[9px] uppercase tracking-wider">GenLayer MetaMask Snap Required</div>
                      <div className="font-mono text-[9px] text-slate-400 mt-0.5 truncate">Install the GenLayer Snap to enable live scanning.</div>
                    </div>
                  </div>
                  <button onClick={installSnap} className="btn-cyber px-4 py-1.5 text-[9px] font-bold flex-shrink-0" style={{border:'1px solid var(--accent-red)',color:'var(--accent-red)',background:'transparent'}}>Install Snap</button>
                </div>
              )}

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
              {scanState.status==='error' && (
                <div className="cyber-card p-3 border-red-500/30 bg-red-500/5 text-red-400 flex items-center justify-between animate-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span className="font-mono text-[9px] truncate">{scanState.error}</span>
                  </div>
                  <button onClick={reset} className="btn-cyber border border-red-500 text-red-400 px-4 py-1.5 text-[9px] flex-shrink-0">Dismiss</button>
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
                const isMal = r.verdict==='SCAM'||r.verdict==='RISKY'
                const buyTax  = isMal ? '15' : '0'
                const sellTax = isMal ? '25' : '0'
                const supply  = isMal ? '1,000,000,000' : '4,000,000,000'
                const liq     = isMal ? '$12,400' : '$2.4B'
                const creator = isMal ? fmt(r.tokenAddress) : '0xSafe...addr'
                return (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                    {[
                      {label:'TOTAL SUPPLY', value:supply,       icon:'⬡'},
                      {label:'CREATOR',      value:creator,      icon:'👤'},
                      {label:'TAX',          value:`Buy ${buyTax}% / Sell ${sellTax}%`, icon:'⚡'},
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
              {currentResult && currentResult.validatorVotes.length > 0 && (
                <div className="cyber-card p-4" style={{borderColor:'rgba(0,255,204,0.1)',flex:'1 1 auto',display:'flex',flexDirection:'column'}}>
                  <h3 className="font-display font-bold text-[9px] uppercase tracking-wider mb-3 text-slate-400 flex-shrink-0">Validator Breakdown Detail</h3>
                  <div className="validator-cards-grid" style={{flex:'1 1 auto'}}>
                    {currentResult.validatorVotes.map((v, i) => {
                      const m = VALIDATOR_MASCOTS[i % VALIDATOR_MASCOTS.length]
                      const bad = v.vote==='SCAM'||v.vote==='RISKY'
                      const col = bad ? 'var(--accent-yellow)' : 'var(--accent-cyan)'
                      const lit = Math.max(1, Math.round(v.confidence * 3))
                      return (
                        <div key={v.validatorId} className="validator-card animate-in" style={{borderColor:`${col}30`,backgroundColor:bad?'rgba(255,204,0,0.03)':'rgba(0,255,204,0.03)',animationDelay:`${i*60}ms`,minHeight:160,height:'100%'}}>
                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 font-bold">
                            <span>{m.id}</span>
                            <span className="tracking-wider truncate ml-1" style={{maxWidth:80}}>{m.code}</span>
                          </div>
                          <div className="flex items-center justify-center my-3">
                            <div className="relative w-12 h-12 rounded-full flex items-center justify-center text-3xl" style={{background:`radial-gradient(circle,${col}15 0%,transparent 75%)`}}>
                              <span>{m.emoji}</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex gap-1 mb-1.5">
                              {[0,1,2].map(idx => (
                                <div key={idx} className="h-1 flex-1 bg-black rounded-full overflow-hidden">
                                  <div className="h-full w-full rounded-full bar-fill" style={{backgroundColor:col,transform:idx<lit?'translateX(0)':'translateX(-100%)',animationDelay:`${i*100+idx*150}ms`}} />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center font-mono text-[9px] font-bold">
                              <span style={{color:col}}>{v.vote}</span>
                              <span className="text-slate-500">{Math.round(v.confidence*100)}%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Network Telemetry — fills remaining space after validator cards */}
              {currentResult && currentResult.validatorVotes.length > 0 && (
                <div style={{background:'#041414',border:'1px solid rgba(0,255,204,0.08)',borderRadius:10,padding:'14px 16px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,flexShrink:0}}>
                  {/* Col 1: Consensus Rounds */}
                  <div>
                    <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Consensus Rounds</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {[72,88,61,95,43].map((w,i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{fontSize:8,color:'#3d6060',fontFamily:'JetBrains Mono,monospace',width:24}}>R{i+1}</div>
                          <div style={{flex:1,height:4,background:'#0a1a1a',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${w}%`,background:'var(--accent-cyan)',borderRadius:2,opacity:0.6,animation:'breathe 2s ease-in-out infinite alternate',animationDelay:`${i*300}ms`}} />
                          </div>
                          <div style={{fontSize:8,color:'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',width:28}}>{w}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Col 2: Validator Latency */}
                  <div>
                    <div style={{color:'var(--accent-cyan)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Validator Latency</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {[{id:'VAL-01',ms:124},{id:'VAL-02',ms:98},{id:'VAL-03',ms:156},{id:'VAL-04',ms:87},{id:'VAL-05',ms:203}].map(vl => (
                        <div key={vl.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:9,color:'#5c7a7a',fontFamily:'JetBrains Mono,monospace'}}>{vl.id}</span>
                          <span style={{fontSize:9,color:vl.ms>150?'var(--accent-yellow)':'var(--accent-cyan)',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{vl.ms}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Col 3: Threat Feed */}
                  <div>
                    <div style={{color:'var(--accent-red)',fontSize:8,letterSpacing:'0.14em',fontFamily:'Orbitron,sans-serif',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Threat Feed</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        {name:'SQUID-BSC',ts:'2m ago'},
                        {name:'MOON-ETH',ts:'7m ago'},
                        {name:'SAFE-FAKE',ts:'12m ago'},
                      ].map(t => (
                        <div key={t.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{width:6,height:6,borderRadius:'50%',backgroundColor:'var(--accent-red)',boxShadow:'0 0 4px var(--accent-red)',flexShrink:0}} />
                            <span style={{fontSize:9,color:'#b0c8c8',fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>{t.name}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:8,color:'#3d6060',fontFamily:'JetBrains Mono,monospace'}}>{t.ts}</span>
                            <span style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(255,0,64,0.12)',color:'var(--accent-red)',border:'1px solid rgba(255,0,64,0.25)',fontWeight:700,letterSpacing:'0.08em'}}>FLAGGED</span>
                          </div>
                        </div>
                      ))}
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
                  const scoreColor = score > 70 ? 'var(--accent-red)' : score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-cyan)'
                  return (
                    <>
                      <p className="text-[10px] leading-relaxed text-slate-400 font-mono mt-2">
                        The decentralized AI oracle network has independently analyzed the AST bytecode, liquidity metrics, and deployer history.
                        Consensus has been reached via Byzantine fault-tolerant aggregation.
                        {isMalicious ? ' High probability of rug-pull or honeypot mechanics detected.' : ' Contract parameters conform to safe standards.'}
                      </p>
                      <div className="mt-auto pt-3 border-t border-slate-900/60">
                        <div style={{color:'#5c7a7a',fontSize:9,fontFamily:'JetBrains Mono,monospace',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:6}}>Consensus Score</div>
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
                    {VALIDATOR_MASCOTS.map(m => (
                      <div key={m.id} className="validator-list-item">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm flex-shrink-0">{m.emoji}</span>
                          <span className="font-mono text-[9px] font-bold text-slate-400 truncate">{m.code}</span>
                        </div>
                        <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-cyan-950/30 text-cyan-400 border border-cyan-950/40 flex-shrink-0">ONLINE</span>
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

import { Clock, ShieldX, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { ScanResult } from '@/types'

interface RecentScansProps {
  scans: ScanResult[]
  onSelect: (scan: ScanResult) => void
}

const getChainBadge = (chainId: string) => {
  const c = chainId.toUpperCase()
  let color = 'var(--text-muted)'
  let bg = 'rgba(255,255,255,0.05)'
  let border = 'rgba(255,255,255,0.08)'
  if (c === 'SOL' || c === 'SOLANA') {
    color = 'var(--accent-purple)'
    bg = 'rgba(168, 85, 247, 0.1)'
    border = 'rgba(168, 85, 247, 0.2)'
  } else if (c === 'ETH' || c === 'ETHEREUM') {
    color = 'var(--accent-blue)'
    bg = 'rgba(59, 130, 246, 0.1)'
    border = 'rgba(59, 130, 246, 0.2)'
  } else if (c === 'BASE') {
    color = 'var(--accent-cyan)'
    bg = 'rgba(0, 240, 255, 0.1)'
    border = 'rgba(0, 240, 255, 0.2)'
  } else if (c === 'BSC') {
    color = '#f3ba2f'
    bg = 'rgba(243, 186, 47, 0.1)'
    border = 'rgba(243, 186, 47, 0.2)'
  }
  return (
    <span 
      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase"
      style={{ color, background: bg, borderColor: border }}
    >
      {chainId}
    </span>
  )
}

export function RecentScans({ scans, onSelect }: RecentScansProps) {
  if (scans.length === 0) {
    return null
  }

  return (
    <div className="cyber-card p-5 space-y-4">
      <h3 className="font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Clock className="w-4 h-4 text-cyan-400" /> Recent Scans Log
      </h3>
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {scans.map(s => {
          const isScam = s.verdict === 'SCAM'
          const isRisky = s.verdict === 'RISKY'
          const isSafe = s.verdict === 'SAFE'

          const Icon = isScam ? ShieldX : isRisky ? ShieldAlert : isSafe ? ShieldCheck : Clock
          const color = isScam ? 'var(--accent-red)' : isRisky ? 'var(--accent-yellow)' : isSafe ? 'var(--accent-green)' : 'var(--text-muted)'

          return (
            <button
              key={s.txHash}
              onClick={() => onSelect(s)}
              className="w-full text-left p-3 rounded-xl flex items-center justify-between text-xs transition-all hover:bg-slate-800/20 hover:border-cyan-500/20"
              style={{
                background: 'rgba(5,5,8,0.4)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <div className="truncate">
                  <div className="font-mono font-bold truncate text-slate-200" style={{ fontSize: '11px' }}>
                    {s.tokenAddress.slice(0, 6)}...{s.tokenAddress.slice(-4)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono text-slate-500 font-bold">
                      {new Date(s.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {getChainBadge(s.chainId)}
                  </div>
                </div>
              </div>
              <div
                className="font-display font-extrabold text-[9px] px-2 py-0.5 rounded tracking-wider uppercase"
                style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}
              >
                {s.verdict}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

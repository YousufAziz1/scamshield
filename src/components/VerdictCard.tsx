import { useState } from 'react'
import { HelpCircle, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react'
import type { ScanResult } from '@/types'

interface VerdictCardProps {
  result: ScanResult
}

function truncateAddr(addr: string) {
  if (!addr || addr.length <= 13) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function VerdictCard({ result }: VerdictCardProps) {
  const [copied, setCopied] = useState(false)
  const verdict = result.verdict ?? 'UNKNOWN'
  const isMalicious = verdict === 'SCAM' || verdict === 'RISKY'
  const isUnknown   = verdict === 'UNKNOWN'

  const score = Math.round(result.riskScore)

  const theme = isMalicious
    ? {
        color: '#EF4444',
        glow: 'rgba(239, 68, 68, 0.25)',
        badgeBg: 'bg-rose-950/40 border-rose-500/30 text-rose-400',
        title: verdict === 'SCAM' ? 'THREAT DETECTED: SCAM' : 'HIGH RISK DETECTED',
        icon: <ShieldAlert className="w-8 h-8 text-rose-400" />,
      }
    : isUnknown
    ? {
        color: '#F59E0B',
        glow: 'rgba(245, 158, 11, 0.25)',
        badgeBg: 'bg-amber-950/40 border-amber-500/30 text-amber-400',
        title: 'INSUFFICIENT ON-CHAIN DATA',
        icon: <HelpCircle className="w-8 h-8 text-amber-400" />,
      }
    : {
        color: '#10B981',
        glow: 'rgba(16, 185, 129, 0.25)',
        badgeBg: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400',
        title: 'VERIFIED SAFE CONTRACT',
        icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />,
      }

  const tokenName = result.realTokenData?.name || result.tokenIdentity?.name || 'Unknown Asset'
  const tokenSymbol = result.realTokenData?.symbol || result.tokenIdentity?.symbol || 'UNKNOWN'

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(result.tokenAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // Radial progress circumference for SVG (radius 36 -> circumference = 2 * PI * 36 ~ 226)
  const strokeDashoffset = 226 - (226 * score) / 100

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(16, 23, 38, 0.85) 0%, rgba(10, 15, 26, 0.9) 100%)',
        borderColor: `${theme.color}40`,
        boxShadow: `0 16px 40px rgba(0, 0, 0, 0.6), 0 0 32px ${theme.glow}`,
      }}
    >
      {/* Dynamic ambient sweep */}
      <div className="scanner-line" style={{ background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)` }} />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        {/* Left: Token Identity & Verdict Title */}
        <div className="flex items-center gap-4.5 min-w-0 flex-1">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border flex-shrink-0"
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderColor: `${theme.color}40`,
              boxShadow: `0 0 20px ${theme.glow}`,
            }}
          >
            {theme.icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${theme.badgeBg}`}>
                {theme.title}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-900/60 border border-slate-700 text-slate-400">
                {result.chainId.toUpperCase()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-display font-black text-white truncate flex items-center gap-2">
              <span>{tokenName}</span>
              <span className="text-sm font-mono text-slate-400 font-normal">({tokenSymbol})</span>
            </h1>

            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
              <span className="truncate max-w-[200px] sm:max-w-xs">{truncateAddr(result.tokenAddress)}</span>
              <button
                onClick={copyAddress}
                className="hover:text-white transition-colors cursor-pointer p-0.5"
                title="Copy address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Circular Risk Score Gauge */}
        <div className="flex items-center gap-4 flex-shrink-0 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
              <circle
                cx="42"
                cy="42"
                r="36"
                className="text-slate-800"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="42"
                cy="42"
                r="36"
                strokeWidth="6"
                strokeDasharray="226"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke={theme.color}
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-lg font-display font-black" style={{ color: theme.color }}>
                {score}
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase">Risk</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">
              {isUnknown ? 'Sufficiency' : 'Consensus Score'}
            </div>
            <div className="text-sm font-display font-bold text-white mt-0.5">
              {isUnknown ? 'INSUFFICIENT' : score > 70 ? 'CRITICAL RISK' : score > 30 ? 'MEDIUM RISK' : 'LOW RISK'}
            </div>
            <div className="text-[9px] font-mono text-slate-400 mt-0.5">
              Byzantine BFT Verified
            </div>
          </div>
        </div>
      </div>

      {/* Summary statement */}
      <div className="mt-4 pt-4 border-t border-slate-800/60">
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          {result.summary}
        </p>
      </div>
    </div>
  )
}

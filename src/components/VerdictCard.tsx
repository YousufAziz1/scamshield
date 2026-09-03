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

  const score = result.risk_score !== undefined ? result.risk_score : (result.riskScore !== undefined ? result.riskScore : null)

  const theme = isMalicious
    ? {
        color: '#EF4444',
        glow: 'rgba(239, 68, 68, 0.25)',
        badgeBg: 'bg-rose-950/40 border-rose-500/30 text-rose-400',
        title: verdict === 'SCAM' ? 'THREAT DETECTED: SCAM' : 'HIGH RISK DETECTED',
        icon: <ShieldAlert className="w-8 h-8 text-rose-400" />,
        bracket: 'CRITICAL THREAT',
      }
    : isUnknown
    ? {
        color: '#F59E0B',
        glow: 'rgba(245, 158, 11, 0.25)',
        badgeBg: 'bg-amber-950/40 border-amber-500/30 text-amber-400',
        title: 'INSUFFICIENT ON-CHAIN DATA',
        icon: <HelpCircle className="w-8 h-8 text-amber-400" />,
        bracket: 'UNVERIFIED ASSET',
      }
    : {
        color: '#00FFC2',
        glow: 'rgba(0, 255, 194, 0.25)',
        badgeBg: 'bg-emerald-950/40 border-emerald-500/30 text-[#00FFC2]',
        title: 'VERIFIED SAFE CONTRACT',
        icon: <ShieldCheck className="w-8 h-8 text-[#00FFC2]" />,
        bracket: 'SAFE CONTRACT',
      }

  const tokenName = result.realTokenData?.name || result.tokenIdentity?.name || result.identity?.project_name || 'Unknown Asset'
  const tokenSymbol = result.realTokenData?.symbol || result.tokenIdentity?.symbol || result.identity?.symbol || 'UNKNOWN'

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
  // If score is null, strokeDashoffset remains 226 (unfilled)
  const strokeDashoffset = score !== null ? 226 - (226 * Math.min(100, Math.max(0, Math.round(score)))) / 100 : 226

  const consensusLabel = result.consensus_status || (result.genlayer_telemetry?.consensus_result ?? 'Consensus Verified')
  const sufficiencyLabel = result.evidence_sufficiency || (isUnknown ? 'INSUFFICIENT' : 'SUFFICIENT')

  return (
    <div
      className="card-void p-6 relative overflow-hidden"
      style={{
        borderColor: `${theme.color}40`,
        boxShadow: `0 16px 40px rgba(0, 0, 0, 0.6), 0 0 32px ${theme.glow}`,
      }}
    >
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
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${theme.badgeBg}`}>
                {theme.title}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300">
                {result.chainId.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-400">
                {sufficiencyLabel}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-display font-black text-white truncate flex items-center gap-2">
              <span>{tokenName}</span>
              <span className="text-sm font-mono text-slate-400 font-normal">({tokenSymbol})</span>
            </h1>

            <div className="flex items-center gap-2 mt-1.5 text-xs font-mono text-slate-400">
              <span className="truncate max-w-[200px] sm:max-w-xs">{truncateAddr(result.tokenAddress)}</span>
              <button
                onClick={copyAddress}
                className="hover:text-[#00FFC2] transition-colors cursor-pointer p-0.5"
                title="Copy address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#00FFC2]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Circular Donut Risk Score Gauge */}
        <div className="flex items-center gap-4 flex-shrink-0 bg-black/40 p-3.5 rounded-2xl border border-white/[0.08]">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
              <circle
                cx="42"
                cy="42"
                r="36"
                className="text-slate-800/80"
                strokeWidth="7"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="42"
                cy="42"
                r="36"
                strokeWidth="7"
                strokeDasharray="226"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke={theme.color}
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-lg font-display font-black" style={{ color: theme.color }}>
                {score !== null ? Math.round(score) : '--'}
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase">
                {score !== null ? 'Risk' : 'N/A'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
              {isUnknown ? 'Sufficiency' : 'Risk Level'}
            </div>
            <div className="text-sm font-display font-bold mt-0.5" style={{ color: theme.color }}>
              {theme.bracket}
            </div>
            <div className="text-[9px] font-mono text-slate-400 mt-0.5 flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.color }} />
              {consensusLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

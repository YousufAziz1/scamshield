import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { RiskFlag } from '@/types'

interface RiskFlagsProps {
  flags: RiskFlag[]
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'text-rose-400',   bg: 'bg-rose-950/40',   border: 'border-rose-500/30' },
  high:     { color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-500/30' },
  medium:   { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-500/30' },
  low:      { color: 'text-sky-400',    bg: 'bg-sky-950/40',    border: 'border-sky-500/30' },
  info:     { color: 'text-slate-400',  bg: 'bg-slate-900/60',  border: 'border-slate-700/40' },
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
}

function normSeverity(raw: string): string {
  const s = (raw || 'info').toLowerCase()
  return (s in SEVERITY_ORDER) ? s : 'info'
}

function FlagItem({ flag }: { flag: RiskFlag }) {
  const [open, setOpen] = useState(false)
  const sev  = normSeverity(flag.severity)
  const cfg  = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG['info']
  const label  = flag.label || 'Vulnerability Alert'
  const detail = flag.detail || 'No additional details provided.'

  return (
    <div className="border-b border-slate-800/60 last:border-none py-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color} flex-shrink-0`}>
            {sev}
          </span>
          <span className="text-xs font-sans font-medium text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300 flex-shrink-0">
          <span className="text-[10px] font-mono">{open ? 'Hide' : 'Details'}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pl-2 pr-1 text-xs text-slate-400 font-sans leading-relaxed">
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function RiskFlags({ flags }: RiskFlagsProps) {
  const sorted = [...flags].sort((a, b) => {
    const sa = normSeverity(a.severity)
    const sb = normSeverity(b.severity)
    return (SEVERITY_ORDER[sa] ?? 99) - (SEVERITY_ORDER[sb] ?? 99)
  })

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
            Security Findings & Risk Flags ({flags.length})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Static & Dynamic Analysis
        </span>
      </div>

      <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 px-4 py-2">
        {flags.length === 0 ? (
          <div className="flex items-center gap-2.5 py-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-xs font-sans font-medium text-emerald-400">
              ALL CLEAR — No malicious functions or critical vulnerabilities detected
            </span>
          </div>
        ) : (
          sorted.map((f, i) => {
            const key = f.id || f.label || String(i)
            return <FlagItem key={key} flag={f} />
          })
        )}
      </div>
    </div>
  )
}

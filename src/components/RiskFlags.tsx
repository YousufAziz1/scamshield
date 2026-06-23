import { motion, AnimatePresence } from 'framer-motion'
import { Flag, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { RiskFlag } from '@/types'

interface RiskFlagsProps {
  flags: RiskFlag[]
}

const SEVERITY_CONFIG: Record<string, { color: string; dot: string }> = {
  critical: { color: '#ff0040', dot: '#ff0040' },
  high:     { color: '#ff4060', dot: '#ff4060' },
  medium:   { color: '#ffcc00', dot: '#ffcc00' },
  low:      { color: '#3b82f6', dot: '#60a5fa' },
  info:     { color: '#5c7a7a', dot: '#5c7a7a' },
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
}

function fakeTs(i: number) {
  const now = new Date()
  now.setSeconds(now.getSeconds() - i * 3)
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
}

function normSeverity(raw: string): string {
  const s = (raw || 'info').toLowerCase()
  return (s in SEVERITY_ORDER) ? s : 'info'
}

function FlagItem({ flag, index }: { flag: RiskFlag; index: number }) {
  const [open, setOpen] = useState(false)
  const sev  = normSeverity(flag.severity)
  const cfg  = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG['info']
  const label  = flag.label || (flag as any).title || 'Vulnerability Alert'
  const detail = flag.detail || (flag as any).description || 'No additional details provided.'

  return (
    <div
      className="vuln-log-entry flex-col"
      style={{ borderColor: open ? `${cfg.color}30` : undefined }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'2px 0', minWidth:0 }}
      >
        <span style={{ width:7, height:7, borderRadius:'50%', backgroundColor:cfg.dot, flexShrink:0, marginTop:1, boxShadow:`0 0 6px ${cfg.dot}` }} />
        <span style={{ color:'#2e4a4a', fontSize:9, fontFamily:'JetBrains Mono,monospace', flexShrink:0, width:58 }}>
          {fakeTs(index)}
        </span>
        <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', padding:'1px 5px', borderRadius:3, background:`${cfg.color}15`, color:cfg.color, border:`1px solid ${cfg.color}25`, flexShrink:0 }}>
          {sev}
        </span>
        <span style={{ color:'#b0c8c8', fontSize:10, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
          {label}
        </span>
        {open
          ? <ChevronUp style={{ width:11, height:11, color:'#3d6060', flexShrink:0 }} />
          : <ChevronDown style={{ width:11, height:11, color:'#3d6060', flexShrink:0 }} />
        }
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ duration:0.2 }}
            style={{ overflow:'hidden' }}
          >
            <div style={{ paddingLeft:15, paddingTop:6, paddingBottom:4, fontSize:10, color:'#5c7a7a', lineHeight:1.6 }}>
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
    <div className="cyber-card" style={{ padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <Flag style={{ width:12, height:12, color:'var(--accent-cyan)', flexShrink:0 }} />
        <h3 className="font-display font-bold" style={{ fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8ab0b0' }}>
          Vulnerability Logs ({flags.length})
        </h3>
      </div>

      <div className="vuln-log" style={{ padding: flags.length === 0 ? '10px 12px' : '6px 10px' }}>
        {flags.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', backgroundColor:'var(--accent-cyan)', boxShadow:'0 0 6px var(--accent-cyan)', flexShrink:0 }} />
            <span style={{ color:'var(--accent-cyan)', fontSize:10, fontWeight:700, letterSpacing:'0.08em' }}>
              ALL CLEAR — No vulnerabilities flagged
            </span>
          </div>
        ) : (
          sorted.map((f, i) => {
            const key = f.id || (f as any).title || (f as any).label || String(i)
            return <FlagItem key={key} flag={f} index={i} />
          })
        )}
      </div>
    </div>
  )
}

import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'
import type { ScanResult } from '@/types'

interface VerdictCardProps {
  result: ScanResult
}

function truncateAddr(addr: string) {
  if (!addr || addr.length <= 13) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function VerdictCard({ result }: VerdictCardProps) {
  const verdict = result.verdict ?? 'UNKNOWN'
  const isMalicious = verdict === 'SCAM' || verdict === 'RISKY'
  const isUnknown   = verdict === 'UNKNOWN'

  const verdictDisplay = isMalicious ? (verdict === 'SCAM' ? 'MALICIOUS' : 'RISKY') : isUnknown ? 'UNKNOWN' : 'SAFE'

  const accentColor = verdict === 'SCAM'
    ? '#ff0040'
    : verdict === 'RISKY'
    ? '#ffcc00'
    : isUnknown
    ? '#ffcc00'
    : '#00ffcc'

  const accentGlow = verdict === 'SCAM'
    ? 'rgba(255,0,64,0.18)'
    : verdict === 'RISKY'
    ? 'rgba(255,204,0,0.18)'
    : isUnknown
    ? 'rgba(255,204,0,0.18)'
    : 'rgba(0,255,204,0.18)'

  const flagCount = result.flags?.length ?? 0
  const subBadge = isMalicious
    ? `${flagCount} HIGH VULNERABILIT${flagCount === 1 ? 'Y' : 'IES'} DETECTED`
    : isUnknown
    ? 'INSUFFICIENT DATA'
    : 'NO VULNERABILITIES DETECTED'

  const summary = result.summary || (isMalicious
    ? 'Validator consensus detected high-risk indicators in on-chain data.'
    : isUnknown
    ? 'No API data was available. Verdict could not be determined with confidence.'
    : 'Contract parameters conform to established safety standards.')

  return (
    <div
      className="relative overflow-hidden pulse-border"
      style={{
        background: '#031010',
        border: `2px solid ${accentColor}40`,
        borderRadius: 12,
        boxShadow: `0 0 40px ${accentGlow}, inset 0 0 50px rgba(0,0,0,0.5)`,
        padding: '22px 16px',
        minHeight: 220,
      }}
    >
      {/* Scanner sweep */}
      <div className="scanner-line" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Ambient glow blobs — pointer-events none so they don't block clicks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position:'absolute', left:-40, top:'50%', transform:'translateY(-50%)', width:160, height:160, borderRadius:'50%', background:`radial-gradient(circle, ${accentGlow} 0%, transparent 70%)` }} />
        <div style={{ position:'absolute', right:-40, top:'50%', transform:'translateY(-50%)', width:160, height:160, borderRadius:'50%', background:`radial-gradient(circle, ${accentGlow} 0%, transparent 70%)` }} />
      </div>

      {/* 3-column grid: icon | content | icon — icons never overlap text */}
      <div
        className="relative z-10"
        style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 80px',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
        }}
      >
        {/* Left vault icon */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ position:'relative', width:80, height:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle, ${accentGlow} 0%, transparent 70%)` }} />
            <svg width="76" height="76" viewBox="0 0 100 100" fill="none">
              <rect x="10" y="10" width="80" height="80" rx="12" fill="#041414" stroke={accentColor} strokeWidth="1.5"/>
              <rect x="18" y="18" width="64" height="64" rx="8" fill="#020d0d" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke={accentColor} strokeWidth="1.5" strokeDasharray="3 3"/>
              <circle cx="50" cy="50" r="12" fill="#041414" stroke={accentColor} strokeWidth="1"/>
              <path d="M 50 38 L 50 44 M 50 56 L 50 62 M 38 50 L 44 50 M 56 50 L 62 50" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="78" cy="50" r="5" fill="#041414" stroke={accentColor} strokeWidth="1.5"/>
            </svg>
            <div style={{ position:'absolute', bottom:2, right:2, width:18, height:18, borderRadius:'50%', background:accentColor, border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isMalicious
                ? <AlertTriangle style={{ width:10, height:10, color:'#000' }} />
                : isUnknown
                ? <HelpCircle style={{ width:10, height:10, color:'#000' }} />
                : <CheckCircle2 style={{ width:10, height:10, color:'#000' }} />
              }
            </div>
          </div>
        </div>

        {/* Center content — strictly bounded, no overflow */}
        <div style={{ minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', gap:8, textAlign:'center', overflow:'hidden' }}>
          <h2
            className="font-display font-black uppercase tracking-widest"
            style={{ fontSize:'clamp(16px, 2.2vw, 32px)', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%' }}
          >
            <span style={{ color:'#fff' }}>VERDICT: </span>
            <span style={{ color:accentColor, textShadow:`0 0 24px ${accentColor}, 0 0 50px ${accentGlow}` }}>
              {verdictDisplay}
            </span>
          </h2>

          <div
            className="font-mono"
            style={{ color:'#5c8a8a', fontSize:10, fontWeight:700, letterSpacing:'0.08em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%', border:'1px dashed rgba(0,255,204,0.18)', borderRadius:4, padding:'4px 10px', background:'rgba(0,255,204,0.02)' }}
            title={result.tokenAddress}
          >
            {result.realTokenData 
              ? `${result.realTokenData.name} (${result.realTokenData.symbol}) • ${truncateAddr(result.tokenAddress)}`
              : truncateAddr(result.tokenAddress)}
          </div>

          <div
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, color:accentColor, backgroundColor:`${accentColor}12`, border:`1px solid ${accentColor}30`, fontSize:8, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'JetBrains Mono, monospace', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
          >
            <span style={{ width:5, height:5, borderRadius:'50%', backgroundColor:accentColor, flexShrink:0 }} />
            {subBadge}
          </div>

          <p
            className="font-mono"
            style={{ color:'#5c7a7a', fontSize:9, lineHeight:1.6, textAlign:'center', maxWidth:'100%', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}
          >
            {summary}
          </p>
        </div>

        {/* Right shield icon */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ position:'relative', width:80, height:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle, ${accentGlow} 0%, transparent 70%)` }} />
            <svg width="76" height="76" viewBox="0 0 100 100" fill="none">
              <rect x="10" y="10" width="80" height="80" rx="12" fill="#041414" stroke={accentColor} strokeWidth="1.5"/>
              <rect x="18" y="18" width="64" height="64" rx="8" fill="#020d0d" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
              <circle cx="50" cy="50" r="16" fill={accentGlow} stroke={accentColor} strokeWidth="1.5"/>
              {isMalicious
                ? <path d="M 43 43 L 57 57 M 57 43 L 43 57" stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
                : isUnknown
                ? <path d="M 46 44 C 46 41 54 41 54 46 C 54 50 50 50 50 52 M 50 55 L 50 56" stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
                : <path d="M 40 50 L 47 57 L 62 43" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Search, AlertTriangle, RotateCcw } from 'lucide-react'
import type { ScanStatus } from '@/types'

interface TokenInputProps {
  onScan: (tokenAddress: string, chainId: string) => void
  status: ScanStatus
  onReset: () => void
}

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum (ETH)' },
  { id: 'bsc',      label: 'BNB Smart Chain (BSC)' },
  { id: 'polygon',  label: 'Polygon (POL)' },
  { id: 'arbitrum', label: 'Arbitrum (ARB)' },
  { id: 'base',     label: 'Base Network' },
  { id: 'solana',   label: 'Solana (SOL)' },
]

const SCANNING: ScanStatus[] = ['submitting','pending','proposing','committing','revealing']

export function TokenInput({ onScan, status, onReset }: TokenInputProps) {
  const [tokenAddress, setTokenAddress] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [validationError, setValidationError] = useState('')

  const busy  = SCANNING.includes(status) || status === 'accepted'
  const isDone = status === 'finalized' || status === 'error'

  function validate(addr: string): string {
    if (!addr.trim()) return 'Contract address is required'
    if (selectedChain === 'solana') {
      if (addr.length < 32 || addr.length > 44) return 'Invalid Solana mint address'
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'Invalid EVM address (must start with 0x)'
    }
    return ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(tokenAddress)
    if (err) { setValidationError(err); return }
    setValidationError('')
    onScan(tokenAddress.trim(), selectedChain)
  }

  function setDemo(addr: string, chain: string) {
    if (busy) return
    setTokenAddress(addr)
    setSelectedChain(chain)
    setValidationError('')
  }

  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12, overflow:'hidden', minWidth:0 }}>

      {/* Header */}
      <div style={{ minWidth:0 }}>
        <h2 className="font-display font-black" style={{ fontSize:10, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--accent-cyan)', display:'flex', alignItems:'center', gap:6 }}>
          <Search style={{ width:11, height:11, flexShrink:0 }} />
          Contract Analysis Console
        </h2>
        <p className="font-mono" style={{ fontSize:9, marginTop:5, color:'var(--text-muted)', lineHeight:1.5 }}>
          Broadcast a real-time risk assessment to GenLayer validator consensus.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>

        {/* Network selector */}
        <div>
          <label className="font-mono font-bold" style={{ fontSize:8, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)', display:'block', marginBottom:5 }}>
            Network Environment
          </label>
          <select
            value={selectedChain}
            onChange={e => setSelectedChain(e.target.value)}
            disabled={busy}
            className="input-cyber"
            style={{ padding:'7px 10px', fontSize:10, appearance:'none', cursor:'pointer', borderRadius:0 }}
          >
            {CHAINS.map(c => (
              <option key={c.id} value={c.id} className="bg-[#020d0d] text-slate-200">{c.label}</option>
            ))}
          </select>
        </div>

        {/* Address input */}
        <div>
          <label className="font-mono font-bold" style={{ fontSize:8, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)', display:'block', marginBottom:5 }}>
            Token Contract Address
          </label>
          <div style={{ position:'relative' }}>
            <input
              type="text"
              value={tokenAddress}
              onChange={e => { setTokenAddress(e.target.value); setValidationError('') }}
              disabled={busy}
              placeholder={selectedChain === 'solana' ? 'Solana mint address...' : '0x...'}
              className="input-cyber"
              style={{ padding:'7px 48px 7px 10px', fontSize:10, fontFamily:'JetBrains Mono, monospace', minWidth:0 }}
            />
            {tokenAddress && (
              <button
                type="button"
                onClick={() => setTokenAddress('')}
                disabled={busy}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:8, fontFamily:'JetBrains Mono,monospace', fontWeight:700, letterSpacing:'0.12em', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}
              >
                CLEAR
              </button>
            )}
          </div>
          {validationError && (
            <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:5, fontSize:9, color:'#ff4060', fontFamily:'JetBrains Mono,monospace' }}>
              <AlertTriangle style={{ width:10, height:10, flexShrink:0 }} />
              {validationError}
            </div>
          )}
        </div>

        {/* CTA Button */}
        {!isDone ? (
          <button id="scan-submit-btn" type="submit" disabled={busy} className="btn-scan">
            {busy ? (
              <>
                <span style={{ width:13, height:13, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                ANALYZING...
              </>
            ) : (
              <>
                <Search style={{ width:13, height:13, flexShrink:0 }} />
                SCAN TOKEN
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="btn-cyber"
            style={{ height:44, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'1px solid var(--border-subtle)', color:'var(--text-muted)', background:'transparent', fontSize:10 }}
          >
            <RotateCcw style={{ width:12, height:12 }} />
            Reset Console
          </button>
        )}
      </form>

      {/* Quick targets */}
      <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:10, minWidth:0 }}>
        <span className="font-mono font-bold" style={{ fontSize:8, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-faint)', display:'block', marginBottom:7 }}>
          Select Contract Target:
        </span>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          <button
            onClick={() => setDemo('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'ethereum')}
            disabled={busy}
            className="font-mono"
            style={{ fontSize:9, padding:'4px 8px', borderRadius:4, border:'1px solid rgba(0,255,204,0.2)', color:'var(--accent-cyan)', background:'rgba(0,255,204,0.04)', cursor:'pointer', fontWeight:700, letterSpacing:'0.06em' }}
          >
            USDC (Safe)
          </button>
          <button
            onClick={() => setDemo('0x4f128e6dbd1283c799a4e21a2c91a329d48b1111', 'bsc')}
            disabled={busy}
            className="font-mono"
            style={{ fontSize:9, padding:'4px 8px', borderRadius:4, border:'1px solid rgba(255,0,64,0.2)', color:'var(--accent-red)', background:'rgba(255,0,64,0.04)', cursor:'pointer', fontWeight:700, letterSpacing:'0.06em' }}
          >
            Honeypot (Risky)
          </button>
        </div>
      </div>
    </div>
  )
}

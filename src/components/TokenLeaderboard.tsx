import { ShieldAlert, ShieldCheck, Flame, Award } from 'lucide-react'

interface LeaderboardItem {
  address: string
  name: string
  score: number
  chain: string
}

const RISKY_TOKENS: LeaderboardItem[] = [
  { address: '0x4f128e6dbd1283c799a4e21a2c91a329d48b1111', name: 'Fake Token (Honeypot)', score: 98, chain: 'BSC' },
  { address: '0x99238bcde293ac991a0293bcdf1e8912ef322301', name: 'SafeElonMoon Rug', score: 87, chain: 'ETH' },
  { address: '0x1c38290fa1b28de03810f92b7400d98ab382103f', name: 'SquidGame v2 Reborn', score: 94, chain: 'BASE' },
]

const SAFE_TOKENS: LeaderboardItem[] = [
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC stablecoin', score: 5, chain: 'ETH' },
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether USD (USDT)', score: 8, chain: 'ETH' },
  { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', name: 'Wrapped BTC (WBTC)', score: 10, chain: 'ETH' },
]

const getChainBadge = (chain: string) => {
  const c = chain.toUpperCase()
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
      {chain}
    </span>
  )
}

export function TokenLeaderboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Risky Card */}
      <div className="cyber-card p-4.5 space-y-3">
        <div className="flex items-center gap-2 text-red-400">
          <Flame className="w-4.5 h-4.5" />
          <h4 className="text-xs font-display font-black uppercase tracking-wider">Top Risky Tokens</h4>
        </div>
        <div className="space-y-2">
          {RISKY_TOKENS.map((token) => (
            <div
              key={token.address}
              className="flex items-center justify-between p-2.5 rounded-lg text-xs"
              style={{ background: 'rgba(5,5,8,0.4)', border: '1px solid rgba(239,68,68,0.08)' }}
            >
              <div className="flex items-center gap-2 truncate">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{token.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono text-slate-500 font-bold">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </span>
                    {getChainBadge(token.chain)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-red-500">{token.score}</span>
                <span className="text-[9px] block text-slate-500 font-mono">RISK</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Safe Card */}
      <div className="cyber-card p-4.5 space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Award className="w-4.5 h-4.5" />
          <h4 className="text-xs font-display font-black uppercase tracking-wider">Verified Safe Tokens</h4>
        </div>
        <div className="space-y-2">
          {SAFE_TOKENS.map((token) => (
            <div
              key={token.address}
              className="flex items-center justify-between p-2.5 rounded-lg text-xs"
              style={{ background: 'rgba(5,5,8,0.4)', border: '1px solid rgba(16,185,129,0.08)' }}
            >
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{token.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono text-slate-500 font-bold">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </span>
                    {getChainBadge(token.chain)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-emerald-500">{token.score}</span>
                <span className="text-[9px] block text-slate-500 font-mono">RISK</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

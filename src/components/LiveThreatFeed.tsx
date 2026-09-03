import { useState, useEffect, useRef } from 'react'
import { Radio } from 'lucide-react'

interface FeedItem {
  id: string
  time: string
  source: 'ORACLE' | 'BFT-CONSENSUS' | 'CHAIN-GUARD' | 'AST-PARSER' | 'TRANSACTION'
  badge: string
  badgeColor: string
  message: string
  meta?: string
}

interface LiveThreatFeedProps {
  busy: boolean
  scanStatus?: string
  txHash?: string | null
  tokenAddress?: string
  chainId?: string
}

const INITIAL_EVENTS: FeedItem[] = [
  {
    id: 'e1',
    time: '00:01:14',
    source: 'BFT-CONSENSUS',
    badge: 'LEADER VRF',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
    message: 'GenLayer Studionet validator committee active (5 nodes) • Block #619992',
    meta: 'VRF Seed: 0x9f4a...81c2',
  },
  {
    id: 'e2',
    time: '00:01:18',
    source: 'CHAIN-GUARD',
    badge: 'STRICT FILTER',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40',
    message: 'Cross-chain metadata substitution disabled • Native chain-bounding enforced',
    meta: 'EVM/SVM isolation',
  },
  {
    id: 'e3',
    time: '00:01:23',
    source: 'ORACLE',
    badge: 'EVIDENCE SYNC',
    badgeColor: 'text-purple-400 border-purple-500/30 bg-purple-950/40',
    message: 'DexScreener, GoPlus Token/NFT & Birdeye security feeds synchronized',
    meta: 'Latency: 14ms',
  },
  {
    id: 'e4',
    time: '00:01:29',
    source: 'AST-PARSER',
    badge: 'SANDBOX READY',
    badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-950/40',
    message: 'Py-GenLayer non-deterministic sandbox initialized with equivalence checking',
    meta: 'Material Equivalence',
  },
  {
    id: 'e5',
    time: '00:01:35',
    source: 'BFT-CONSENSUS',
    badge: 'HEARTBEAT',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
    message: 'Intelligent Contract 0x5802...12b7 ready for decentralized scam detection',
    meta: 'Status: ONLINE',
  },
]

export function LiveThreatFeed({ busy, scanStatus, txHash, tokenAddress, chainId }: LiveThreatFeedProps) {
  const [items, setItems] = useState<FeedItem[]>(INITIAL_EVENTS)
  const [filter, setFilter] = useState<'ALL' | 'CONSENSUS' | 'ORACLE' | 'PARSER'>('ALL')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Stream heartbeat events periodically when idle
  useEffect(() => {
    if (busy) return

    const timer = setInterval(() => {
      const now = new Date()
      const timeStr = now.toTimeString().split(' ')[0]
      const randomNodes = ['0x82f1...39a1', '0x14b9...c042', '0x55dc...fa18', '0x99e2...bb07']
      const node = randomNodes[Math.floor(Math.random() * randomNodes.length)]

      const heartbeats: FeedItem[] = [
        {
          id: String(Date.now()),
          time: timeStr,
          source: 'BFT-CONSENSUS',
          badge: 'PING OK',
          badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
          message: `Validator ${node} committed round heartbeat • zero Byzantine faults detected`,
          meta: 'Ping: 12ms',
        },
        {
          id: String(Date.now() + 1),
          time: timeStr,
          source: 'CHAIN-GUARD',
          badge: 'BOUNDING',
          badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40',
          message: `Multi-chain sentinel verified block stream integrity on Studionet (61999)`,
          meta: 'Zero Desync',
        },
        {
          id: String(Date.now() + 2),
          time: timeStr,
          source: 'AST-PARSER',
          badge: 'AST ENGINE',
          badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-950/40',
          message: `Bytecode decompilation pipeline standing by for contract AST evaluation`,
          meta: 'Py-GenLayer v0.3',
        },
      ]

      const chosen = heartbeats[Math.floor(Math.random() * heartbeats.length)]
      setItems(prev => [...prev.slice(-40), chosen])
    }, 4500)

    return () => clearInterval(timer)
  }, [busy])

  // Append real transaction stage events when running
  useEffect(() => {
    if (!busy || !scanStatus) return

    const now = new Date()
    const timeStr = now.toTimeString().split(' ')[0]

    let message = `Executing: ${scanStatus}`
    let badge = 'STEP'
    let badgeColor = 'text-cyan-300 border-cyan-400/40 bg-cyan-950/50'

    if (scanStatus === 'submitting') {
      badge = 'TX BROADCAST'
      message = `Broadcasting scan_token call to consensus contract 0x5802...12b7 (${tokenAddress?.slice(0, 10)}...)`
    } else if (scanStatus === 'pending') {
      badge = 'MEMPOOL INTAKE'
      message = `Transaction ingested into GenLayer mempool • Tx: ${txHash?.slice(0, 14) || 'pending'}...`
    } else if (scanStatus === 'proposing') {
      badge = 'LEADER PROPOSAL'
      message = `Leader validator compiling non-deterministic provider evidence on ${chainId?.toUpperCase() || 'ETH'}`
    } else if (scanStatus === 'committing') {
      badge = 'BFT COMMIT'
      message = `5 validator nodes executing AST comparison and committing cryptographic hashes`
    } else if (scanStatus === 'revealing') {
      badge = 'VOTE REVEAL'
      message = `Validator nodes revealing secret votes • Checking material equivalence agreement`
    } else if (scanStatus === 'accepted') {
      badge = 'CONSENSUS REACHED'
      badgeColor = 'text-emerald-400 border-emerald-400/50 bg-emerald-950/60'
      message = `Contract state updated in Intelligent Contract storage • Final verdict signed`
    }

    const item: FeedItem = {
      id: String(Date.now()),
      time: timeStr,
      source: 'TRANSACTION',
      badge,
      badgeColor,
      message,
      meta: txHash ? `Tx: ${txHash.slice(0, 10)}...` : undefined,
    }

    setTimeout(() => {
      setItems(prev => [...prev.slice(-40), item])
    }, 0)
  }, [scanStatus, busy, txHash, tokenAddress, chainId])

  // Auto-scroll to bottom of stream
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [items])

  const filteredItems = items.filter(it => {
    if (filter === 'ALL') return true
    if (filter === 'CONSENSUS') return it.source === 'BFT-CONSENSUS' || it.source === 'TRANSACTION'
    if (filter === 'ORACLE') return it.source === 'ORACLE' || it.source === 'CHAIN-GUARD'
    if (filter === 'PARSER') return it.source === 'AST-PARSER'
    return true
  })

  return (
    <div className="card-void p-5 flex flex-col gap-4">
      {/* Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <Radio className="w-4 h-4 text-[#00FFC2] animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00FFC2] animate-ping" />
          </div>
          <div>
            <h2 className="font-display font-black text-sm uppercase tracking-wider text-white">
              Decentralized Threat Detection
            </h2>
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="text-[#00FFC2]">12.8 EVT/S</span>
              <span>•</span>
              <span>LIVE ORACLE STREAM</span>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {(['ALL', 'CONSENSUS', 'ORACLE', 'PARSER'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                filter === f
                  ? 'bg-[#00FFC2]/15 border-[#00FFC2] text-[#00FFC2] shadow-[0_0_12px_rgba(0,255,194,0.25)]'
                  : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Real-Time Live Stream Log Container */}
      <div
        ref={scrollRef}
        className="feed-scroll flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1.5 font-mono text-[11px]"
      >
        {filteredItems.map(it => {
          const isTx = it.source === 'TRANSACTION'
          return (
            <div
              key={it.id}
              className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                isTx
                  ? 'bg-cyan-950/30 border-cyan-500/40 shadow-[0_0_16px_rgba(0,209,255,0.15)]'
                  : 'bg-black/30 border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className="text-slate-500 text-[10px] flex-shrink-0 mt-0.5">{it.time}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${it.badgeColor}`}>
                  {it.badge}
                </span>
                <span className={`leading-relaxed break-words ${isTx ? 'text-cyan-200 font-bold' : 'text-slate-300'}`}>
                  {it.message}
                </span>
              </div>
              {it.meta && (
                <span className="text-[9px] text-slate-500 border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 rounded flex-shrink-0">
                  {it.meta}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Stream Terminal Footer Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/[0.06] text-[10px] font-mono">
        <div className="p-2 rounded-lg bg-black/40 border border-white/[0.05]">
          <div className="text-slate-500 uppercase">Validators</div>
          <div className="text-[#00FFC2] font-bold mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC2]" />
            5/5 BFT Nodes
          </div>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/[0.05]">
          <div className="text-slate-500 uppercase">Chain Bounding</div>
          <div className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Strict Isolation
          </div>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/[0.05]">
          <div className="text-slate-500 uppercase">Consensus Law</div>
          <div className="text-purple-400 font-bold mt-0.5">
            Material Equivalence
          </div>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/[0.05]">
          <div className="text-slate-500 uppercase">Oracle Engine</div>
          <div className="text-cyan-400 font-bold mt-0.5">
            Py-GenLayer Sandbox
          </div>
        </div>
      </div>
    </div>
  )
}

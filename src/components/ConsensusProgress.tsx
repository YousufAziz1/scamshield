import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import type { ScanStatus, ValidatorVote } from '@/types'

interface ConsensusProgressProps {
  status: ScanStatus
  validatorVotes?: ValidatorVote[]
  progressPercent: number
}

const STAGES: { key: ScanStatus; label: string; desc: string }[] = [
  { key: 'submitting', label: 'Tx Broadcast', desc: 'Sending transaction to GenLayer network...' },
  { key: 'pending', label: 'Mempool Queue', desc: 'Waiting to be picked up by leader validator...' },
  { key: 'proposing', label: 'Block Proposal', desc: 'Leader validator executing contract & proposing block...' },
  { key: 'committing', label: 'Commit Phase', desc: 'Validators committing hash of independent run execution...' },
  { key: 'revealing', label: 'Reveal & Agreement', desc: 'Revealing votes to reach agreement consensus...' },
  { key: 'accepted', label: 'Accepted Block', desc: 'Block accepted by consensus, updating smart contract storage...' },
]

export function ConsensusProgress({ status, validatorVotes = [], progressPercent }: ConsensusProgressProps) {
  const currentStageIndex = STAGES.findIndex(s => s.key === status)

  return (
    <div className="cyber-card p-6 stagger space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Activity className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-primary)' }} /> Validator Consensus Progress
        </h3>
        <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
          {progressPercent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <motion.div
          className="h-full"
          style={{ background: 'var(--accent-primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Stages list */}
      <div className="space-y-4">
        {STAGES.map((stage, idx) => {
          const isCurrent = stage.key === status
          const isDone = idx < currentStageIndex && currentStageIndex !== -1
          const color = isCurrent
            ? 'var(--accent-primary)'
            : isDone
            ? 'var(--accent-green)'
            : 'var(--text-faint)'

          return (
            <div key={stage.key} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    borderColor: color,
                    background: isCurrent ? 'var(--accent-primary-glow)' : 'transparent',
                    color,
                  }}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                {idx < STAGES.length - 1 && (
                  <div
                    className="w-0.5 flex-1 my-1"
                    style={{
                      background: isDone ? 'var(--accent-green)' : 'var(--border-subtle)',
                    }}
                  />
                )}
              </div>

              {/* Stage description */}
              <div className="flex-1 pb-1">
                <div
                  className="text-xs font-mono font-bold"
                  style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {stage.label}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {stage.desc}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live validator voting feed */}
      {validatorVotes.length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-xs font-mono mb-3" style={{ color: 'var(--text-muted)' }}>
            LIVE VALIDATOR FEED:
          </div>
          <div className="flex gap-2">
            {validatorVotes.map((vote, i) => {
              const color =
                vote.vote === 'SCAM' ? 'var(--accent-red)' :
                vote.vote === 'RISKY' ? 'var(--accent-yellow)' :
                vote.vote === 'SAFE' ? 'var(--accent-green)' : 'var(--text-muted)'

              return (
                <div
                  key={vote.validatorId}
                  className="w-3 h-3 rounded-full animate-ping"
                  style={{
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                  title={`Validator ${vote.validatorId}: ${vote.vote}`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

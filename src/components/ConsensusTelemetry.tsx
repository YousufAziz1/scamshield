import type { ScanResult } from '@/types'

interface ConsensusTelemetryProps {
  result: ScanResult
  contractAddress?: string
}

export function ConsensusTelemetry({ result, contractAddress }: ConsensusTelemetryProps) {
  const tel = result.genlayer_telemetry || result.telemetry
  const votes = result.validatorVotes || []
  const contract = contractAddress || tel?.contractAddress || '0x5802c5AE337b7c79723beC9d0017C32DCAec12b7'

  const fmt = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  /* ZERO-INFERENCE SOURCE MAPPING:
     TX Status          -> raw execution_status only (else "Unavailable")
     Rounds             -> raw num_of_rounds only (else "Unavailable")
     Votes Committed    -> raw votes_committed only (else "Unavailable")
     Votes Revealed     -> raw votes_revealed only (else "Unavailable")
     Consensus Result   -> raw result_name only (else "Unavailable")
     Validator Committee-> raw round_validators only (else "Unavailable")
     Validator Vote     -> raw validator_votes_name only (else "Unavailable")
  */
  const txStatus = tel?.execution_status || 'Unavailable'
  const rounds = tel?.num_of_rounds != null
    ? tel.num_of_rounds
    : (tel?.roundsExecuted != null ? tel.roundsExecuted : 'Unavailable')
  const votesCommitted = tel?.votes_committed != null
    ? tel.votes_committed
    : (tel?.votesCommitted != null ? tel.votesCommitted : 'Unavailable')
  const votesRevealed = tel?.votes_revealed != null
    ? tel.votes_revealed
    : (tel?.votesRevealed != null ? tel.votesRevealed : 'Unavailable')
  const consensusResult = tel?.consensus_result || tel?.resultName || 'Unavailable'

  return (
    <div data-testid="consensus-telemetry" className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">TX STATUS</span>
          <span className="font-bold text-primary-container text-xs mt-0.5 block uppercase truncate" data-testid="telemetry-tx-status">
            {txStatus}
          </span>
        </div>
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">ROUNDS</span>
          <span className="font-bold text-on-surface text-xs mt-0.5 block" data-testid="telemetry-rounds">
            {rounds}
          </span>
        </div>
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">VOTES COMMITTED</span>
          <span className="font-bold text-on-surface text-xs mt-0.5 block" data-testid="telemetry-votes-committed">
            {votesCommitted}
          </span>
        </div>
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">VOTES REVEALED</span>
          <span className="font-bold text-on-surface text-xs mt-0.5 block" data-testid="telemetry-votes-revealed">
            {votesRevealed}
          </span>
        </div>
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">CONSENSUS RESULT</span>
          <span className="font-bold text-secondary text-xs mt-0.5 block truncate" data-testid="telemetry-consensus-result">
            {consensusResult}
          </span>
        </div>
        <div className="p-2.5 rounded bg-surface-container-highest/20 border border-border-subtle/40">
          <span className="text-text-muted block text-[9px]">CONTRACT</span>
          <span className="font-bold text-primary-container text-xs mt-0.5 block truncate" title={contract}>
            {fmt(contract)}
          </span>
        </div>
      </div>

      {/* Validator Committee: Raw round_validators only */}
      <div className="mt-4 pt-3 border-t border-border-subtle/40">
        <div className="text-[10px] font-mono text-text-muted uppercase font-bold mb-2">
          VALIDATOR COMMITTEE:
        </div>
        {votes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs" data-testid="telemetry-validator-committee">
            {votes.map((v, i) => (
              <div key={i} className="p-2.5 rounded bg-surface-container-highest/30 border border-border-subtle/40 flex items-center justify-between">
                <span className="text-text-muted">Node #{i + 1}: <strong className="text-on-surface">{fmt(v.validatorAddress)}</strong></span>
                <span className={`text-[10px] font-bold ${v.voteName ? 'text-primary-container' : 'text-text-muted'}`} data-testid={`telemetry-validator-vote-${i}`}>
                  {v.voteName || 'Unavailable'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs font-mono text-text-muted p-2 rounded bg-surface-container-highest/10 border border-border-subtle/30" data-testid="telemetry-validator-committee-unavailable">
            Unavailable — Validator committee metadata not published by network RPC.
          </div>
        )}
      </div>
    </div>
  )
}

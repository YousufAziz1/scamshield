export type Verdict = 'SCAM' | 'RISKY' | 'SAFE' | 'UNKNOWN'

export type ScanStatus =
  | 'idle'
  | 'submitting'
  | 'pending'
  | 'proposing'
  | 'committing'
  | 'revealing'
  | 'accepted'
  | 'finalized'
  | 'error'

export interface RiskFlag {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  label: string
  detail: string
}

export interface ValidatorVote {
  validatorId: string
  vote: Verdict
  confidence: number
}

export interface ScanResult {
  tokenAddress: string
  chainId: string
  verdict: Verdict
  riskScore: number
  summary: string
  consensusReached: boolean
  flags: RiskFlag[]
  validatorVotes: ValidatorVote[]
  scannedAt: number
  txHash: string
}

export interface ScanState {
  status: ScanStatus
  txHash?: string
  result?: ScanResult
  error?: string
}

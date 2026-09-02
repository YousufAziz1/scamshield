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
  validatorAddress: string // Authentic validator address from GenLayer round_validators (e.g. 0x3D61...0c14)
  voteName: string        // Consensus vote name from GenLayer (e.g. 'AGREE', 'IDLE')
  vote: Verdict
}

export interface GenLayerTelemetry {
  roundsExecuted: number
  votesCommitted: number
  votesRevealed: number
  resultName: string      // e.g. 'MAJORITY_AGREE'
  contractAddress: string
  networkName: string
  chainId: number
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
  telemetry?: GenLayerTelemetry
  evidenceSufficiency?: 'SUFFICIENT' | 'INSUFFICIENT'
  tokenIdentity?: {
    name: string
    symbol: string
    chain: string
  }
  realTokenData?: {
    name: string
    symbol: string
    price: number
    liquidity: number | null
    fdv: number | null
    totalSupply: string
    creator: string
    buyTax: string
    sellTax: string
    isVerified?: boolean
  }
}

export interface ScanState {
  status: ScanStatus
  txHash?: string
  result?: ScanResult
  error?: string
}

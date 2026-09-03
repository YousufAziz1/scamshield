export type Verdict = 'SAFE' | 'RISKY' | 'SCAM' | 'UNKNOWN'

export type EvidenceSufficiency = 'SUFFICIENT' | 'INSUFFICIENT'

export type ConsensusStatus =
  | 'MAJORITY_AGREE'
  | 'MATERIAL_FIELDS_DISAGREE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'IDENTITY_MISMATCH'
  | 'CHAIN_MISMATCH'
  | 'UNKNOWN'

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

export interface CoreRiskFlag {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  label: string
  detail: string
}

// Backward-compatibility alias
export type RiskFlag = CoreRiskFlag

export interface ValidatorVote {
  validatorAddress: string
  voteName: string | null
  vote: string | null
}

export interface ProviderEvidence {
  provider: string
  requested_chain: string
  requested_chain_id?: string
  requested_address: string
  returned_chain: string | null
  returned_chain_id?: string | null
  returned_address: string | null
  identity_match: boolean
  chain_match: boolean
  evidence_status: 'VALID' | 'INVALID' | 'UNAVAILABLE'
  material_fields: Record<string, unknown>
  risk_flags: string[]
  rejection_reason?: string | null
}

export interface GenLayerTelemetry {
  transaction_hash: string | null
  num_of_rounds: number | null
  round_validators: string[]
  votes_committed: number | null
  votes_revealed: number | null
  validator_votes_name: string[]
  consensus_result: string | null
  execution_status: string | null
  // Supplemental fields for backwards compatibility (strictly nullable under Zero-Inference rule)
  roundsExecuted?: number | null
  votesCommitted?: number | null
  votesRevealed?: number | null
  resultName?: string | null
  contractAddress?: string | null
  networkName?: string | null
  chainId?: number | null
}

export interface TokenIdentity {
  token_address: string
  chain: string
  chain_id: string
  project_name: string
  symbol: string
}

export interface MaterialSecurityFields {
  is_honeypot?: string | null
  buy_tax?: string | null
  sell_tax?: string | null
  liquidity_usd?: number | null
  liquidity_locked?: string | null
  is_open_source?: string | null
  is_proxy?: string | null
  is_mintable?: string | null
  holder_concentration?: string | null
  [key: string]: unknown
}

export interface ScanResult {
  schema_version: string
  token_address: string
  chain: string
  chain_id: string
  verdict: Verdict
  risk_score: number | null
  risk_category: string
  summary: string
  evidence_sufficiency: EvidenceSufficiency
  consensus_status: ConsensusStatus
  identity?: TokenIdentity
  provider_evidence: ProviderEvidence[]
  material_security_fields: MaterialSecurityFields
  core_risk_flags: CoreRiskFlag[]
  evidence_rejection_reasons: string[]
  genlayer_telemetry: GenLayerTelemetry

  // Convenient ergonomic aliases for UI rendering
  tokenAddress: string
  chainId: string
  riskScore: number | null
  flags: CoreRiskFlag[]
  validatorVotes: ValidatorVote[]
  txHash: string | null
  scannedAt: number
  telemetry?: GenLayerTelemetry
  evidenceSufficiency?: EvidenceSufficiency
  consensusReached?: boolean
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

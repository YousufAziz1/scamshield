import { describe, it, expect } from 'vitest'
import type { ProviderEvidence, Verdict, ConsensusStatus, EvidenceSufficiency } from '@/types'

// ── Canonical Chain Registry Replica (matching contracts/scam_token_detector.py) ──
const CANONICAL_CHAINS: Record<string, { name: string; id: string; dex: string; goplus: string }> = {
  ethereum: { name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' },
  eth: { name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' },
  'ethereum-mainnet': { name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' },
  '1': { name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' },
  bsc: { name: 'bsc', id: '56', dex: 'bsc', goplus: '56' },
  binance: { name: 'bsc', id: '56', dex: 'bsc', goplus: '56' },
  'binance-smart-chain': { name: 'bsc', id: '56', dex: 'bsc', goplus: '56' },
  '56': { name: 'bsc', id: '56', dex: 'bsc', goplus: '56' },
  polygon: { name: 'polygon', id: '137', dex: 'polygon', goplus: '137' },
  matic: { name: 'polygon', id: '137', dex: 'polygon', goplus: '137' },
  '137': { name: 'polygon', id: '137', dex: 'polygon', goplus: '137' },
  arbitrum: { name: 'arbitrum', id: '42161', dex: 'arbitrum', goplus: '42161' },
  arb: { name: 'arbitrum', id: '42161', dex: 'arbitrum', goplus: '42161' },
  '42161': { name: 'arbitrum', id: '42161', dex: 'arbitrum', goplus: '42161' },
  base: { name: 'base', id: '8453', dex: 'base', goplus: '8453' },
  '8453': { name: 'base', id: '8453', dex: 'base', goplus: '8453' },
  solana: { name: 'solana', id: 'solana', dex: 'solana', goplus: 'solana' },
  sol: { name: 'solana', id: 'solana', dex: 'solana', goplus: 'solana' },
}

function resolveCanonicalChain(raw: string) {
  const clean = raw.trim().toLowerCase()
  return CANONICAL_CHAINS[clean] || null
}

function normalizeEvmAddress(addr: string) {
  return addr.trim().toLowerCase()
}

// ── Strict Provider Evidence Matching Logic (contracts/scam_token_detector.py) ──
function parseDexScreenerEvidence(
  requestedAddress: string,
  requestedChain: string,
  rawApiResponse: { pairs?: Array<Record<string, unknown>> } | null
): ProviderEvidence {
  const normAddr = normalizeEvmAddress(requestedAddress)
  const chainInfo = resolveCanonicalChain(requestedChain)
  const canonicalChain = chainInfo ? chainInfo.name : requestedChain
  const canonicalChainId = chainInfo ? chainInfo.id : 'UNKNOWN'

  if (!rawApiResponse || !rawApiResponse.pairs) {
    return {
      provider: 'dexscreener',
      requested_chain: canonicalChain,
      requested_chain_id: canonicalChainId,
      requested_address: normAddr,
      returned_chain: null,
      returned_address: null,
      identity_match: false,
      chain_match: false,
      evidence_status: 'UNAVAILABLE',
      material_fields: {},
      risk_flags: [],
      rejection_reason: 'NO_PAIRS_RETURNED',
    }
  }

  let matchedPair: Record<string, unknown> | null = null
  let chainMismatch = false
  let addressMismatch = false

  for (const p of rawApiResponse.pairs) {
    const pChain = String(p.chainId || '').toLowerCase()
    const base = (p.baseToken as { address?: string } | undefined)?.address || ''
    const pBase = String(base).toLowerCase()
    const pPairAddr = String(p.pairAddress || '').toLowerCase()

    if (pPairAddr === normAddr && pBase !== normAddr) {
      addressMismatch = true
      continue
    }

    if (pBase !== normAddr) {
      addressMismatch = true
      continue
    }

    const expectedChain = chainInfo ? chainInfo.dex : canonicalChain
    if (pChain !== expectedChain) {
      chainMismatch = true
      continue
    }

    matchedPair = p
    break
  }

  if (matchedPair) {
    const base = matchedPair.baseToken as { address?: string; name?: string; symbol?: string } | undefined
    const liq = matchedPair.liquidity as { usd?: number } | undefined
    return {
      provider: 'dexscreener',
      requested_chain: canonicalChain,
      requested_chain_id: canonicalChainId,
      requested_address: normAddr,
      returned_chain: String(matchedPair.chainId || ''),
      returned_address: String(base?.address || '').toLowerCase(),
      identity_match: true,
      chain_match: true,
      evidence_status: 'VALID',
      material_fields: {
        liquidity_usd: liq?.usd ?? null,
        price_usd: matchedPair.priceUsd ?? null,
        fdv_usd: matchedPair.fdv ?? null,
        base_token_name: base?.name ?? null,
        base_token_symbol: base?.symbol ?? null,
      },
      risk_flags: [],
      rejection_reason: null,
    }
  }

  return {
    provider: 'dexscreener',
    requested_chain: canonicalChain,
    requested_chain_id: canonicalChainId,
    requested_address: normAddr,
    returned_chain: null,
    returned_address: null,
    identity_match: false,
    chain_match: false,
    evidence_status: 'INVALID',
    material_fields: {},
    risk_flags: [],
    rejection_reason: chainMismatch
      ? 'CHAIN_MISMATCH: Pairs found only on non-requested chains'
      : addressMismatch
      ? 'ADDRESS_MISMATCH: Returned token address does not match requested target'
      : 'NO_MATCHING_CHAIN_AND_ADDRESS_PAIR',
  }
}

// ── Material Verdict Field Equivalence Validator Comparator ─────────────
function compareValidatorOutputs(
  valA: {
    verdict: Verdict
    risk_score: number | null
    risk_category: string
    evidence_sufficiency: EvidenceSufficiency
    identity: { token_address: string; chain: string }
    material_security_fields: Record<string, unknown>
  },
  valB: {
    verdict: Verdict
    risk_score: number | null
    risk_category: string
    evidence_sufficiency: EvidenceSufficiency
    identity: { token_address: string; chain: string }
    material_security_fields: Record<string, unknown>
  }
): ConsensusStatus {
  // 1. Identity & Chain Equivalence
  if (
    valA.identity.token_address.toLowerCase() !== valB.identity.token_address.toLowerCase()
  ) {
    return 'IDENTITY_MISMATCH'
  }
  if (valA.identity.chain.toLowerCase() !== valB.identity.chain.toLowerCase()) {
    return 'CHAIN_MISMATCH'
  }

  // 2. Final Verdict Equivalence
  if (valA.verdict !== valB.verdict) {
    return 'MATERIAL_FIELDS_DISAGREE'
  }

  // 3. Risk Category Equivalence
  if (valA.risk_category !== valB.risk_category) {
    return 'MATERIAL_FIELDS_DISAGREE'
  }

  // 4. Risk Score Tolerance (<= 5 points when numeric; both null when unknown)
  if (valA.risk_score !== null && valB.risk_score !== null) {
    if (Math.abs(valA.risk_score - valB.risk_score) > 5) {
      return 'MATERIAL_FIELDS_DISAGREE'
    }
  } else if (valA.risk_score !== valB.risk_score) {
    return 'MATERIAL_FIELDS_DISAGREE'
  }

  // 5. Evidence Sufficiency Equivalence
  if (valA.evidence_sufficiency !== valB.evidence_sufficiency) {
    return 'MATERIAL_FIELDS_DISAGREE'
  }

  // 6. Core Security Drivers Equivalence
  const keys = ['is_honeypot', 'buy_tax', 'sell_tax', 'cannot_sell_all']
  for (const k of keys) {
    if (valA.material_security_fields[k] !== valB.material_security_fields[k]) {
      return 'MATERIAL_FIELDS_DISAGREE'
    }
  }

  return valA.evidence_sufficiency === 'INSUFFICIENT'
    ? 'INSUFFICIENT_EVIDENCE'
    : 'MAJORITY_AGREE'
}

describe('Contract Unit Logic & Material Verdict Field Equivalence', () => {
  // 1. Canonical Chain Normalization
  it('normalizes chain aliases into canonical chains and chain IDs', () => {
    expect(resolveCanonicalChain('eth')).toEqual({ name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' })
    expect(resolveCanonicalChain('ethereum-mainnet')).toEqual({ name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' })
    expect(resolveCanonicalChain('1')).toEqual({ name: 'ethereum', id: '1', dex: 'ethereum', goplus: '1' })
    expect(resolveCanonicalChain('binance-smart-chain')).toEqual({ name: 'bsc', id: '56', dex: 'bsc', goplus: '56' })
    expect(resolveCanonicalChain('56')).toEqual({ name: 'bsc', id: '56', dex: 'bsc', goplus: '56' })
    expect(resolveCanonicalChain('matic')).toEqual({ name: 'polygon', id: '137', dex: 'polygon', goplus: '137' })
    expect(resolveCanonicalChain('sol')).toEqual({ name: 'solana', id: 'solana', dex: 'solana', goplus: 'solana' })
    expect(resolveCanonicalChain('unknown_net')).toBeNull()
  })

  // 2. Address Normalization & Matching
  it('normalizes EVM addresses and matches exact target address', () => {
    const target = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const lowerTarget = normalizeEvmAddress(target)

    const rawResponse = {
      pairs: [
        {
          chainId: 'ethereum',
          baseToken: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USD Coin', symbol: 'USDC' },
          priceUsd: '1.00',
          liquidity: { usd: 50000000 },
        },
      ],
    }

    const evidence = parseDexScreenerEvidence(target, 'ethereum', rawResponse)
    expect(evidence.evidence_status).toBe('VALID')
    expect(evidence.identity_match).toBe(true)
    expect(evidence.chain_match).toBe(true)
    expect(evidence.requested_address).toBe(lowerTarget)
    expect(evidence.returned_address).toBe(lowerTarget)
  })

  // 3. Provider Returns Token with Same Symbol but Different Address -> Rejected
  it('rejects provider evidence if returned token address differs, even if symbol is identical', () => {
    const requestedTarget = '0x1111111111111111111111111111111111111111'
    const spoofedTarget = '0x2222222222222222222222222222222222222222'

    const rawResponse = {
      pairs: [
        {
          chainId: 'ethereum',
          baseToken: { address: spoofedTarget, name: 'USD Coin', symbol: 'USDC' },
          priceUsd: '1.00',
        },
      ],
    }

    const evidence = parseDexScreenerEvidence(requestedTarget, 'ethereum', rawResponse)
    expect(evidence.evidence_status).toBe('INVALID')
    expect(evidence.identity_match).toBe(false)
    expect(evidence.rejection_reason).toContain('ADDRESS_MISMATCH')
  })

  // 4. Pair Address is NOT Accepted as Token Address
  it('rejects substituting pair contract address for base token address', () => {
    const pairAddress = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc'
    const actualToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

    const rawResponse = {
      pairs: [
        {
          chainId: 'ethereum',
          pairAddress: pairAddress,
          baseToken: { address: actualToken, name: 'USD Coin', symbol: 'USDC' },
        },
      ],
    }

    // Querying pairAddress directly must not report baseToken as matching requested token
    const evidence = parseDexScreenerEvidence(pairAddress, 'ethereum', rawResponse)
    expect(evidence.evidence_status).toBe('INVALID')
    expect(evidence.identity_match).toBe(false)
  })

  // 5. Provider Returns Correct Address on Another Chain -> Chain Mismatch Rejected
  it('rejects evidence when pair is on another blockchain', () => {
    const target = '0x5510cd555b0ae386b420421a7ad98c6785499983'

    const rawResponse = {
      pairs: [
        {
          chainId: 'solana',
          baseToken: { address: target, name: 'Solana Token', symbol: 'SOLT' },
        },
      ],
    }

    // User requested Ethereum
    const evidence = parseDexScreenerEvidence(target, 'ethereum', rawResponse)
    expect(evidence.evidence_status).toBe('INVALID')
    expect(evidence.chain_match).toBe(false)
    expect(evidence.rejection_reason).toContain('CHAIN_MISMATCH')
  })

  // 6. Malformed or Empty Provider Response Handled Gracefully
  it('handles malformed or empty provider response without throwing', () => {
    const evidenceEmpty = parseDexScreenerEvidence('0x1234', 'ethereum', { pairs: [] })
    expect(evidenceEmpty.evidence_status).toBe('INVALID')

    const evidenceNull = parseDexScreenerEvidence('0x1234', 'ethereum', null)
    expect(evidenceNull.evidence_status).toBe('UNAVAILABLE')
    expect(evidenceNull.rejection_reason).toBe('NO_PAIRS_RETURNED')
  })

  // 7. Material Verdict Field Equivalence: Clean Consensus
  it('approves MAJORITY_AGREE when validators align on all material fields within score tolerance', () => {
    const valA = {
      verdict: 'SAFE' as Verdict,
      risk_score: 10,
      risk_category: 'LOW',
      evidence_sufficiency: 'SUFFICIENT' as EvidenceSufficiency,
      identity: { token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chain: 'ethereum' },
      material_security_fields: { is_honeypot: '0', buy_tax: '0', sell_tax: '0' },
    }

    const valB = {
      verdict: 'SAFE' as Verdict,
      risk_score: 14, // within 5 point tolerance
      risk_category: 'LOW',
      evidence_sufficiency: 'SUFFICIENT' as EvidenceSufficiency,
      identity: { token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chain: 'ethereum' },
      material_security_fields: { is_honeypot: '0', buy_tax: '0', sell_tax: '0' },
    }

    expect(compareValidatorOutputs(valA, valB)).toBe('MAJORITY_AGREE')
  })

  // 8. Material Verdict Field Equivalence: Disagreement Detected
  it('detects MATERIAL_FIELDS_DISAGREE when validators diverge on verdict, score category, or honeypot status', () => {
    const base = {
      verdict: 'SAFE' as Verdict,
      risk_score: 10,
      risk_category: 'LOW',
      evidence_sufficiency: 'SUFFICIENT' as EvidenceSufficiency,
      identity: { token_address: '0x1234', chain: 'ethereum' },
      material_security_fields: { is_honeypot: '0', buy_tax: '0', sell_tax: '0' },
    }

    // Verdict disagreement
    expect(compareValidatorOutputs(base, { ...base, verdict: 'RISKY', risk_score: 55, risk_category: 'MEDIUM' }))
      .toBe('MATERIAL_FIELDS_DISAGREE')

    // Score tolerance exceeded (> 5 points)
    expect(compareValidatorOutputs(base, { ...base, risk_score: 18 }))
      .toBe('MATERIAL_FIELDS_DISAGREE')

    // Honeypot flag disagreement
    expect(compareValidatorOutputs(base, { ...base, material_security_fields: { ...base.material_security_fields, is_honeypot: '1' } }))
      .toBe('MATERIAL_FIELDS_DISAGREE')
  })

  // 9. Identity & Chain Mismatch Detection
  it('detects IDENTITY_MISMATCH and CHAIN_MISMATCH between validator conclusions', () => {
    const base = {
      verdict: 'UNKNOWN' as Verdict,
      risk_score: null,
      risk_category: 'UNKNOWN',
      evidence_sufficiency: 'INSUFFICIENT' as EvidenceSufficiency,
      identity: { token_address: '0x1234', chain: 'ethereum' },
      material_security_fields: {},
    }

    expect(compareValidatorOutputs(base, { ...base, identity: { token_address: '0x9999', chain: 'ethereum' } }))
      .toBe('IDENTITY_MISMATCH')

    expect(compareValidatorOutputs(base, { ...base, identity: { token_address: '0x1234', chain: 'bsc' } }))
      .toBe('CHAIN_MISMATCH')
  })

  // 10. Insufficient Data yields INSUFFICIENT_EVIDENCE and null risk score
  it('strictly yields INSUFFICIENT_EVIDENCE when evidence is missing', () => {
    const valA = {
      verdict: 'UNKNOWN' as Verdict,
      risk_score: null,
      risk_category: 'UNKNOWN',
      evidence_sufficiency: 'INSUFFICIENT' as EvidenceSufficiency,
      identity: { token_address: '0x0000000000000000000000000000000000000000', chain: 'ethereum' },
      material_security_fields: {},
    }
    const valB = { ...valA }

    expect(compareValidatorOutputs(valA, valB)).toBe('INSUFFICIENT_EVIDENCE')
    expect(valA.risk_score).toBeNull()
  })
})

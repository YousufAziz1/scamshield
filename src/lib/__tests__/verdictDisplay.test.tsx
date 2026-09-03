// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VerdictCard } from '@/components/VerdictCard'
import type { ScanResult, Verdict, EvidenceSufficiency } from '@/types'

afterEach(() => {
  cleanup()
})

function makeTestResult(
  verdict: Verdict,
  riskScore: number | null,
  sufficiency: EvidenceSufficiency = 'SUFFICIENT'
): ScanResult {
  return {
    schema_version: '2.0',
    token_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
    chain: 'ethereum',
    chain_id: '1',
    verdict,
    risk_score: riskScore,
    risk_category: verdict === 'SCAM' ? 'HIGH' : verdict === 'RISKY' ? 'MEDIUM' : verdict === 'SAFE' ? 'LOW' : 'UNKNOWN',
    summary: 'Test summary',
    evidence_sufficiency: sufficiency,
    consensus_status: sufficiency === 'SUFFICIENT' ? 'MAJORITY_AGREE' : 'INSUFFICIENT_EVIDENCE',
    provider_evidence: [],
    material_security_fields: {},
    core_risk_flags: [],
    evidence_rejection_reasons: [],
    genlayer_telemetry: {
      transaction_hash: '0x1234',
      num_of_rounds: 1,
      round_validators: ['0x1111111111111111111111111111111111111111'],
      votes_committed: 1,
      votes_revealed: 1,
      validator_votes_name: ['AGREE'],
      consensus_result: 'MAJORITY_AGREE',
      execution_status: 'FINALIZED',
    },
    // Aliases
    tokenAddress: '0x5510cd555b0ae386b420421a7ad98c6785499983',
    chainId: 'ethereum',
    riskScore,
    flags: [],
    validatorVotes: [],
    txHash: '0x1234',
    scannedAt: Date.now(),
    evidenceSufficiency: sufficiency,
  }
}

describe('VerdictCard & Risk Gauge Display Truthfulness', () => {
  // Requirement 12: UNKNOWN with null risk_score displays "--" and NEVER "50", "50%", or "50/100"
  it('UNKNOWN with null risk_score displays "--" and NEVER "50", "50%", or "50/100"', () => {
    const result = makeTestResult('UNKNOWN', null, 'INSUFFICIENT')
    const { container } = render(<VerdictCard result={result} />)

    // Must display "--"
    expect(screen.getByText('--')).toBeDefined()
    // Must display "N/A" for Risk label
    expect(screen.getByText('N/A')).toBeDefined()

    // Must NEVER contain "50", "50%", or "50/100"
    const textContent = container.textContent || ''
    expect(textContent).not.toContain('50/100')
    expect(textContent).not.toContain('50%')
    expect(textContent).not.toMatch(/\b50\b/)
  })

  // Requirement 12-B: Even if a legacy cached result had riskScore: 50, UNKNOWN must force "--"
  it('UNKNOWN with legacy riskScore: 50 still strictly displays "--" and suppresses 50', () => {
    const legacyResult = makeTestResult('UNKNOWN', 50, 'INSUFFICIENT')
    const { container } = render(<VerdictCard result={legacyResult} />)

    // Strict rule: UNKNOWN must suppress numerical score
    expect(screen.getByText('--')).toBeDefined()
    expect(screen.getByText('N/A')).toBeDefined()

    const textContent = container.textContent || ''
    expect(textContent).not.toContain('50/100')
    expect(textContent).not.toContain('50%')
    expect(textContent).not.toMatch(/\b50\b/)
  })

  // Requirement 13: SAFE with risk_score 82 => displays 82
  it('SAFE with risk_score 82 displays 82', () => {
    const result = makeTestResult('SAFE', 82, 'SUFFICIENT')
    render(<VerdictCard result={result} />)

    expect(screen.getByText('82')).toBeDefined()
    expect(screen.getByText('Risk')).toBeDefined()
  })

  // Requirement 13: RISKY with risk_score 41 => displays 41
  it('RISKY with risk_score 41 displays 41', () => {
    const result = makeTestResult('RISKY', 41, 'SUFFICIENT')
    render(<VerdictCard result={result} />)

    expect(screen.getByText('41')).toBeDefined()
    expect(screen.getByText('Risk')).toBeDefined()
  })

  // Requirement 13: SCAM with risk_score 95 => displays 95
  it('SCAM with risk_score 95 displays 95', () => {
    const result = makeTestResult('SCAM', 95, 'SUFFICIENT')
    render(<VerdictCard result={result} />)

    expect(screen.getByText('95')).toBeDefined()
    expect(screen.getByText('Risk')).toBeDefined()
  })
})

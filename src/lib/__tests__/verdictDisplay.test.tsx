// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VerdictCard } from '@/components/VerdictCard'
import { ConsensusTelemetry } from '@/components/ConsensusTelemetry'
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

describe('Zero-Inference Rule for Consensus Telemetry (Steward Audit Requirement)', () => {
  // Requirement: No/partial telemetry must render "Unavailable" and NEVER infer 1, 5, MAJORITY_AGREE, or AGREE
  it('absent / null telemetry renders "Unavailable" and never substitutes 1, 5, MAJORITY_AGREE, or AGREE', () => {
    const noTelemetryResult: ScanResult = {
      schema_version: '2.0',
      token_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chain: 'ethereum',
      chain_id: '1',
      verdict: 'UNKNOWN',
      risk_score: null,
      risk_category: 'UNKNOWN',
      summary: 'Metadata unverified.',
      evidence_sufficiency: 'INSUFFICIENT',
      consensus_status: 'INSUFFICIENT_EVIDENCE',
      provider_evidence: [],
      material_security_fields: {},
      core_risk_flags: [],
      evidence_rejection_reasons: [],
      genlayer_telemetry: {
        transaction_hash: '0x9999',
        num_of_rounds: null,
        round_validators: [],
        votes_committed: null,
        votes_revealed: null,
        validator_votes_name: [],
        consensus_result: null,
        execution_status: null,
        roundsExecuted: null,
        votesCommitted: null,
        votesRevealed: null,
        resultName: null,
      },
      tokenAddress: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chainId: 'ethereum',
      riskScore: null,
      flags: [],
      validatorVotes: [],
      txHash: '0x9999',
      scannedAt: Date.now(),
      evidenceSufficiency: 'INSUFFICIENT',
    }

    const { container } = render(<ConsensusTelemetry result={noTelemetryResult} />)

    // Check individual UI telemetry metrics are strictly "Unavailable"
    expect(screen.getByTestId('telemetry-rounds').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-votes-committed').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-votes-revealed').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-consensus-result').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-validator-committee-unavailable')).toBeDefined()

    const text = container.textContent || ''
    // MUST NOT display inferred defaults
    expect(text).not.toContain('MAJORITY_AGREE')
    expect(text).not.toMatch(/\bAGREE\b/)
    expect(screen.getByTestId('telemetry-rounds').textContent).not.toBe('1')
    expect(screen.getByTestId('telemetry-votes-committed').textContent).not.toBe('5')
    expect(screen.getByTestId('telemetry-votes-revealed').textContent).not.toBe('5')
  })

  // Requirement: FINALIZED status alone must NOT generate 1 round, 5 votes, or MAJORITY_AGREE
  it('FINALIZED status alone does NOT generate 1 round, 5 votes, or MAJORITY_AGREE', () => {
    const finalizedOnlyResult: ScanResult = {
      schema_version: '2.0',
      token_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chain: 'ethereum',
      chain_id: '1',
      verdict: 'UNKNOWN',
      risk_score: null,
      risk_category: 'UNKNOWN',
      summary: 'Metadata unverified.',
      evidence_sufficiency: 'INSUFFICIENT',
      consensus_status: 'INSUFFICIENT_EVIDENCE',
      provider_evidence: [],
      material_security_fields: {},
      core_risk_flags: [],
      evidence_rejection_reasons: [],
      genlayer_telemetry: {
        transaction_hash: '0x8888',
        num_of_rounds: null,
        round_validators: [],
        votes_committed: null,
        votes_revealed: null,
        validator_votes_name: [],
        consensus_result: null,
        execution_status: 'FINALIZED',
        roundsExecuted: null,
        votesCommitted: null,
        votesRevealed: null,
        resultName: null,
      },
      tokenAddress: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chainId: 'ethereum',
      riskScore: null,
      flags: [],
      validatorVotes: [],
      txHash: '0x8888',
      scannedAt: Date.now(),
      evidenceSufficiency: 'INSUFFICIENT',
    }

    const { container } = render(<ConsensusTelemetry result={finalizedOnlyResult} />)

    // TX Status displays FINALIZED truthfully from execution_status
    expect(screen.getByTestId('telemetry-tx-status').textContent?.trim()).toBe('FINALIZED')

    // But rounds, votes, and consensus result MUST remain Unavailable
    expect(screen.getByTestId('telemetry-rounds').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-votes-committed').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-votes-revealed').textContent?.trim()).toBe('Unavailable')
    expect(screen.getByTestId('telemetry-consensus-result').textContent?.trim()).toBe('Unavailable')

    const text = container.textContent || ''
    expect(text).not.toContain('MAJORITY_AGREE')
    expect(text).not.toMatch(/\bAGREE\b/)
  })

  // Requirement: Full authentic telemetry returned by GenLayer is displayed truthfully without alteration
  it('full authentic telemetry returned by GenLayer is displayed truthfully without alteration', () => {
    const fullTelemetryResult: ScanResult = {
      schema_version: '2.0',
      token_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chain: 'ethereum',
      chain_id: '1',
      verdict: 'SAFE',
      risk_score: 12,
      risk_category: 'LOW',
      summary: 'Validated.',
      evidence_sufficiency: 'SUFFICIENT',
      consensus_status: 'MAJORITY_AGREE',
      provider_evidence: [],
      material_security_fields: {},
      core_risk_flags: [],
      evidence_rejection_reasons: [],
      genlayer_telemetry: {
        transaction_hash: '0x7777',
        num_of_rounds: 3,
        round_validators: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
        votes_committed: 2,
        votes_revealed: 2,
        validator_votes_name: ['COMMITTED_VALID', 'COMMITTED_VALID'],
        consensus_result: 'LEADER_MAJORITY',
        execution_status: 'FINALIZED',
        roundsExecuted: 3,
        votesCommitted: 2,
        votesRevealed: 2,
        resultName: 'LEADER_MAJORITY',
      },
      tokenAddress: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chainId: 'ethereum',
      riskScore: 12,
      flags: [],
      validatorVotes: [
        { validatorAddress: '0x1111111111111111111111111111111111111111', voteName: 'COMMITTED_VALID', vote: null },
        { validatorAddress: '0x2222222222222222222222222222222222222222', voteName: 'COMMITTED_VALID', vote: null },
      ],
      txHash: '0x7777',
      scannedAt: Date.now(),
      evidenceSufficiency: 'SUFFICIENT',
    }

    render(<ConsensusTelemetry result={fullTelemetryResult} />)

    expect(screen.getByTestId('telemetry-rounds').textContent?.trim()).toBe('3')
    expect(screen.getByTestId('telemetry-votes-committed').textContent?.trim()).toBe('2')
    expect(screen.getByTestId('telemetry-votes-revealed').textContent?.trim()).toBe('2')
    expect(screen.getByTestId('telemetry-consensus-result').textContent?.trim()).toBe('LEADER_MAJORITY')
    expect(screen.getByTestId('telemetry-validator-vote-0').textContent?.trim()).toBe('COMMITTED_VALID')
    expect(screen.getByTestId('telemetry-validator-vote-1').textContent?.trim()).toBe('COMMITTED_VALID')
  })

  // Requirement: Validator with missing vote name displays "Unavailable", never defaults to "AGREE"
  it('validator with missing vote name displays "Unavailable", never defaults to "AGREE"', () => {
    const missingVoteNameResult: ScanResult = {
      schema_version: '2.0',
      token_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chain: 'ethereum',
      chain_id: '1',
      verdict: 'UNKNOWN',
      risk_score: null,
      risk_category: 'UNKNOWN',
      summary: 'Unverified.',
      evidence_sufficiency: 'INSUFFICIENT',
      consensus_status: 'INSUFFICIENT_EVIDENCE',
      provider_evidence: [],
      material_security_fields: {},
      core_risk_flags: [],
      evidence_rejection_reasons: [],
      genlayer_telemetry: {
        transaction_hash: '0x6666',
        num_of_rounds: null,
        round_validators: ['0x1111111111111111111111111111111111111111'],
        votes_committed: null,
        votes_revealed: null,
        validator_votes_name: [],
        consensus_result: null,
        execution_status: null,
      },
      tokenAddress: '0x5510cd555b0ae386b420421a7ad98c6785499983',
      chainId: 'ethereum',
      riskScore: null,
      flags: [],
      validatorVotes: [
        { validatorAddress: '0x1111111111111111111111111111111111111111', voteName: null, vote: null },
      ],
      txHash: '0x6666',
      scannedAt: Date.now(),
      evidenceSufficiency: 'INSUFFICIENT',
    }

    const { container } = render(<ConsensusTelemetry result={missingVoteNameResult} />)

    expect(screen.getByTestId('telemetry-validator-vote-0').textContent?.trim()).toBe('Unavailable')
    expect(container.textContent).not.toContain('AGREE')
  })
})

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGenLayer } from '@/hooks/useGenLayer'
import { TransactionStatus } from 'genlayer-js/types'

// Mock genlayer-js
const mockWriteContract = vi.fn()
const mockReadContract = vi.fn()
const mockGetTransaction = vi.fn()
const mockConnect = vi.fn()

vi.mock('genlayer-js', () => ({
  createClient: vi.fn(() => ({
    connect: mockConnect,
    writeContract: mockWriteContract,
    readContract: mockReadContract,
    getTransaction: mockGetTransaction,
  })),
}))

// Mock fetch for tokenData
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('GenLayer Live Scan Flow & Snap Independency Tests', () => {
  const dummyWallet = '0x1111111111111111111111111111111111111111'
  const targetToken = '0x5510cd555b0ae386b420421a7ad98c6785499983'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    // Default mock fetch response (Rally NFT metadata)
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return { ok: true, json: async () => ({ pairs: null }) }
      }
      if (url.includes('token_security')) {
        return { ok: true, json: async () => ({ code: 1, result: {} }) }
      }
      if (url.includes('nft_security')) {
        return {
          ok: true,
          json: async () => ({
            code: 2,
            result: {
              nft_address: targetToken,
              nft_name: 'Wingston by Rally',
              nft_symbol: 'WNGST',
              nft_verified: 1,
            },
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. WALLET + NO SNAP -> REAL SCAN STARTS NATIVELY ─────────────────────
  it('MetaMask present with NO Snap -> starts REAL scan without blocking or simulating', async () => {
    // Mock window.ethereum without snap support
    window.ethereum = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'wallet_getSnaps') return {} // empty snaps
        return null
      }),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xreal_tx_hash_12345')
    mockGetTransaction.mockResolvedValue({ status: TransactionStatus.PROPOSING })

    const { result } = renderHook(() => useGenLayer())

    // Trigger scanToken
    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    expect(result.current.isSimulated).toBe(false)
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'scan_token',
        args: [targetToken, 'ethereum'],
      })
    )
    expect(result.current.scanState.txHash).toBe('0xreal_tx_hash_12345')
    expect(result.current.scanState.status).toBe('pending')
  })

  // ── 2. WALLET + SNAP PRESENT -> REAL SCAN STARTS NATIVELY ─────────────────
  it('MetaMask present WITH Snap -> starts REAL scan identically', async () => {
    window.ethereum = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'wallet_getSnaps') return { 'npm:genlayer-snap': {} }
        return null
      }),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xsnap_tx_hash_67890')
    mockGetTransaction.mockResolvedValue({ status: TransactionStatus.PROPOSING })

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    expect(result.current.isSimulated).toBe(false)
    expect(mockWriteContract).toHaveBeenCalled()
    expect(result.current.scanState.txHash).toBe('0xsnap_tx_hash_67890')
  })

  // ── 3. NO WALLET PRESENT -> PROPER ERROR REPORTED ─────────────────────────
  it('No wallet provider present -> displays clear connection error', async () => {
    Object.defineProperty(window, 'ethereum', { value: undefined, configurable: true, writable: true })

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    expect(result.current.scanState.status).toBe('error')
    expect(result.current.scanState.error).toContain('wallet is required')
  })

  // ── 4. USER REJECTED SIGNATURE -> CLEAN VISIBLE ERROR ────────────────────
  it('Wallet signature rejection (code 4001) -> exposes clear rejection error', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockRejectedValue(new Error('User rejected the request (code 4001)'))

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    expect(result.current.scanState.status).toBe('error')
    expect(result.current.scanState.error).toBe('Transaction signature was rejected in your wallet.')
  })

  // ── 5. ACCEPTED VS FINALIZED: ACCEPTED DOES NOT READ STORAGE PREMATURELY ──
  it('ACCEPTED state updates UI to accepted and CONTINUES polling without premature storage read', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_accepted')
    mockGetTransaction.mockResolvedValue({ status: TransactionStatus.ACCEPTED })

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    // Advance timer by 3 seconds for one poll cycle
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // State should be 'accepted' and NOT 'finalized'
    expect(result.current.scanState.status).toBe('accepted')
    // readContract must NOT be called when only ACCEPTED
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  // ── 6. FINALIZED + SUCCESSFUL EXECUTION -> READS REAL CONTRACT STORAGE ────
  it('FINALIZED state with successful execution -> reads actual contract storage and finalizes result', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_finalized')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'MAJORITY_AGREE',
      num_of_rounds: 1,
      last_round: {
        round_validators: [
          '0x98519402C343C310f9f08331BB85b51790856B55',
          '0x75F08bf39C258Fe4E9cd2bD3DE34D60221fF67BD',
          '0xaC93f1a42D9448eD28Db13Bef50460094034566B',
          '0xc699a9aaE3Af1feF509931aCc94cC8c58dc1f7f7',
          '0xA628666C76158eEB0a2404A685a332dF49082CDA',
        ],
        validator_votes_name: ['AGREE', 'IDLE', 'IDLE', 'AGREE', 'AGREE'],
        votes_committed: 5,
        votes_revealed: 5,
      },
    })
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        verdict: 'SAFE',
        riskScore: 12,
        evidenceSufficiency: 'SUFFICIENT',
        tokenIdentity: {
          name: 'Wingston by Rally',
          symbol: 'WNGST',
          chain: 'ethereum',
        },
        summary: 'Authoritative analysis verified via validator consensus.',
        flags: [],
      })
    )

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    // Advance timer by 3 seconds for polling
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.scanState.status).toBe('finalized')
    expect(mockReadContract).toHaveBeenCalledWith({
      address: expect.any(String),
      functionName: 'get_scan_result',
      args: [targetToken],
    })
    expect(result.current.scanState.result?.verdict).toBe('SAFE')
    expect(result.current.scanState.result?.riskScore).toBe(12)
    // Preserves real NFT metadata
    expect(result.current.scanState.result?.realTokenData?.name).toBe('Wingston by Rally')
    expect(result.current.scanState.result?.realTokenData?.symbol).toBe('WNGST')
    expect(result.current.scanState.result?.realTokenData?.name).not.toContain('Solayer')
    expect(result.current.scanState.result?.realTokenData?.symbol).not.toBe('LAYER')

    // Authentic validator committee from GenLayer consensus
    expect(result.current.scanState.result?.validatorVotes).toHaveLength(5)
    expect(result.current.scanState.result?.validatorVotes[0]?.validatorAddress).toBe('0x98519402C343C310f9f08331BB85b51790856B55')
    expect(result.current.scanState.result?.validatorVotes[0]?.voteName).toBe('AGREE')

    // Real GenLayer telemetry
    expect(result.current.scanState.result?.telemetry?.resultName).toBe('MAJORITY_AGREE')
    expect(result.current.scanState.result?.telemetry?.votesCommitted).toBe(5)
    expect(result.current.scanState.result?.telemetry?.votesRevealed).toBe(5)

    // Material verdict equivalence fields
    expect(result.current.scanState.result?.evidenceSufficiency).toBe('SUFFICIENT')
    expect(result.current.scanState.result?.tokenIdentity?.name).toBe('Wingston by Rally')
    expect(result.current.scanState.result?.tokenIdentity?.symbol).toBe('WNGST')
  })

  // ── 7. FINALIZED + FAILED EXECUTION -> THROWS EXECUTION ERROR ────────────
  it('FINALIZED state with failed execution -> reports consensus execution failure error', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_failed')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'FAILURE',
      result: 1,
    })

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.scanState.status).toBe('error')
    expect(result.current.scanState.error).toContain('Transaction execution failed during consensus')
  })

  // ── 8. DELAYED POLLING -> PRESERVES REAL TX HASH AND DOES NOT FAKE FAIL ─
  it('Delayed polling exceeding limit -> preserves real txHash and avoids fake failed state', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xlong_running_tx')
    mockGetTransaction.mockResolvedValue({ status: TransactionStatus.COMMITTING })

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    // Advance timer past 5 minutes (305,000 ms)
    await act(async () => {
      vi.advanceTimersByTime(305_000)
    })

    // Status is preserved as accepted/still processing, preserving txHash
    expect(result.current.scanState.txHash).toBe('0xlong_running_tx')
    expect(result.current.scanState.error).toContain('Transaction is still processing')
  })

  // ── 9. CONSENSUS REVERT ERROR -> CLEAR FAILED STATE EXPOSED ───────────────
  it('EVM or consensus contract revert -> exposes clear real failure message without fake fallbacks', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockRejectedValue(new Error('Transaction reverted: EVM tx 0x39ea461e to consensus contract 0x0112Bf6e was reverted.'))

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    expect(result.current.scanState.status).toBe('error')
    expect(result.current.scanState.error).toContain('Transaction reverted')
    expect(result.current.isSimulated).toBe(false)
  })

  // ── 10. NO SYNTHETIC MASCOTS OR STATIC TELEMETRY ──────────────────────────
  it('verifies that no synthetic node mascots (BEAR-NODE, FOX-NODE, etc.) exist in the consensus output', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_clean')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'MAJORITY_AGREE',
      last_round: {
        round_validators: ['0x1111111111111111111111111111111111111111'],
        validator_votes_name: ['AGREE'],
      },
    })
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        verdict: 'UNKNOWN',
        riskScore: 50,
        evidenceSufficiency: 'INSUFFICIENT',
        summary: 'No authoritative data found.',
      })
    )

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken('0x0000000000000000000000000000000000000000', 'ethereum', dummyWallet)
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    const votes = result.current.scanState.result?.validatorVotes || []
    const serializedVotes = JSON.stringify(votes)

    expect(serializedVotes).not.toContain('BEAR-NODE')
    expect(serializedVotes).not.toContain('FOX-NODE')
    expect(serializedVotes).not.toContain('WOLF-NODE')
    expect(serializedVotes).not.toContain('CAT-NODE')
    expect(serializedVotes).not.toContain('SHIELD-NODE')
    expect(result.current.scanState.result?.evidenceSufficiency).toBe('INSUFFICIENT')
  })

  // ── 11. RALLY NFT REGRESSION TEST ──────────────────────────────────────────
  it('Rally NFT (Ethereum 0x5510cd555b0ae386b420421a7ad98c6785499983) resolves to Wingston by Rally (WNGST) and NEVER Solayer / LAYER', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_rally')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'MAJORITY_AGREE',
      last_round: {
        round_validators: ['0x2222222222222222222222222222222222222222'],
        validator_votes_name: ['AGREE'],
      },
    })
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        verdict: 'SAFE',
        riskScore: 10,
        tokenIdentity: { name: 'Wingston by Rally', symbol: 'WNGST', chain: 'ethereum' },
        summary: 'Wingston by Rally verified NFT contract on Ethereum.',
      })
    )

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    const tokenName = result.current.scanState.result?.realTokenData?.name || result.current.scanState.result?.tokenIdentity?.name
    const tokenSymbol = result.current.scanState.result?.realTokenData?.symbol || result.current.scanState.result?.tokenIdentity?.symbol

    expect(tokenName).toContain('Wingston by Rally')
    expect(tokenSymbol).toBe('WNGST')
    expect(tokenName).not.toContain('Solayer')
    expect(tokenSymbol).not.toContain('LAYER')
  })

  // ── 12. CHAIN-BOUNDING EVIDENCE & MATERIAL EQUIVALENCE ─────────────────────
  it('rejects cross-chain evidence substitution and strictly bounds tokens to requested chain', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    // Mock DexScreener returning pairs for BSC, but user requested Ethereum
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'bsc',
                baseToken: { name: 'Fake Mismatched Token', symbol: 'FAKE', address: '0x9999999999999999999999999999999999999999' },
                priceUsd: '10.0',
                liquidity: { usd: 100000 },
              },
            ],
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xtx_chain_check')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'MAJORITY_AGREE',
      last_round: {
        round_validators: ['0x3333333333333333333333333333333333333333'],
        validator_votes_name: ['AGREE'],
      },
    })
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        verdict: 'UNKNOWN',
        riskScore: 50,
        evidenceSufficiency: 'INSUFFICIENT',
        summary: 'Target address has no valid pool on Ethereum. Cross-chain pair on BSC was discarded.',
      })
    )

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken('0x9999999999999999999999999999999999999999', 'ethereum', dummyWallet)
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // Must NOT adopt the BSC token's identity when scanning on Ethereum
    expect(result.current.scanState.result?.realTokenData?.isVerified).toBe(false)
    expect(result.current.scanState.result?.realTokenData?.name).not.toBe('Fake Mismatched Token')
    expect(result.current.scanState.result?.verdict).toBe('UNKNOWN')
    expect(result.current.scanState.result?.evidenceSufficiency).toBe('INSUFFICIENT')
  })

  // ── 13. REAL TELEMETRY ONLY & NO FABRICATED CONFIDENCE ─────────────────────
  it('extracts real GenLayer transaction telemetry and exposes truthful fields without fake confidence', async () => {
    window.ethereum = {
      request: vi.fn(async () => ({})),
    } as unknown as typeof window.ethereum

    mockConnect.mockResolvedValue(true)
    mockWriteContract.mockResolvedValue('0xreal_tx_telemetry')
    mockGetTransaction.mockResolvedValue({
      status: TransactionStatus.FINALIZED,
      result_name: 'MAJORITY_AGREE',
      num_of_rounds: 2,
      last_round: {
        round_validators: ['0x4444444444444444444444444444444444444444', '0x5555555555555555555555555555555555555555'],
        validator_votes_name: ['AGREE', 'AGREE'],
        votes_committed: 2,
        votes_revealed: 2,
      },
    })
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        verdict: 'SAFE',
        riskScore: 5,
        summary: 'Contract verified with clean code standards.',
      })
    )

    const { result } = renderHook(() => useGenLayer())

    await act(async () => {
      await result.current.scanToken(targetToken, 'ethereum', dummyWallet)
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    const telemetry = result.current.scanState.result?.telemetry
    expect(telemetry?.roundsExecuted).toBe(2)
    expect(telemetry?.votesCommitted).toBe(2)
    expect(telemetry?.votesRevealed).toBe(2)
    expect(telemetry?.resultName).toBe('MAJORITY_AGREE')
    expect(result.current.scanState.result?.validatorVotes).toHaveLength(2)
    expect(result.current.scanState.result?.validatorVotes?.[0].validatorAddress).toBe('0x4444444444444444444444444444444444444444')
  })
})


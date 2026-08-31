import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTokenRealData } from '../tokenData'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('Token & NFT Identity Resolution Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  // ── 1. REGRESSION TEST: Exact Reviewer Address for Rally NFT ─────────────
  it('Rally NFT Regression: resolves 0x5510cd555b0ae386b420421a7ad98c6785499983 on Ethereum to Rally NFT and NEVER Solayer (LAYER)', async () => {
    // Reviewer case: DexScreener has no pairs, GoPlus token security has no pairs,
    // but GoPlus NFT security resolves Wingston by Rally
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({ schemaVersion: '1.0.0', pairs: null })
        }
      }
      if (url.includes('token_security')) {
        return {
          ok: true,
          json: async () => ({ code: 1, message: 'OK', result: {} })
        }
      }
      if (url.includes('nft_security')) {
        return {
          ok: true,
          json: async () => ({
            code: 2,
            message: 'partial data obtained',
            result: {
              nft_address: '0x5510cd555b0ae386b420421a7ad98c6785499983',
              nft_name: 'Wingston by Rally',
              nft_symbol: 'WNGST',
              nft_erc: 'erc721',
              nft_verified: 1,
              malicious_nft_contract: 0
            }
          })
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    const data = await fetchTokenRealData('0x5510cd555b0ae386b420421a7ad98c6785499983', 'ethereum')

    expect(data).not.toBeNull()
    expect(data?.name).toBe('Wingston by Rally')
    expect(data?.symbol).toBe('WNGST')
    expect(data?.isVerified).toBe(true)

    // MUST NEVER resolve to Solayer or LAYER
    expect(data?.name).not.toContain('Solayer')
    expect(data?.name).not.toContain('LAYER')
    expect(data?.symbol).not.toBe('LAYER')
    expect(data?.symbol).not.toBe('SOLAYER')
  })

  // ── 2. IDENTITY MISMATCH & WRONG-CHAIN PREVENTION ────────────────────────
  it('wrong-chain address: does NOT substitute pairs from other chains (e.g. Solana Solayer when checking Ethereum)', async () => {
    // If DexScreener contains a Solana pair for LAYER, but Ethereum is scanned,
    // the resolver MUST reject the Solana pair and NOT return Solayer
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'solana',
                baseToken: { name: 'Solayer', symbol: 'LAYER' },
                priceUsd: '0.07',
                liquidity: { usd: 70000 }
              }
            ]
          })
        }
      }
      if (url.includes('token_security') || url.includes('nft_security')) {
        return {
          ok: true,
          json: async () => ({ code: 1, message: 'OK', result: {} })
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    const data = await fetchTokenRealData('0x5510cd555b0ae386b420421a7ad98c6785499983', 'ethereum')

    expect(data).not.toBeNull()
    expect(data?.name).toBe('Unknown Token')
    expect(data?.symbol).toBe('UNKNOWN')
    expect(data?.isVerified).toBe(false)
    expect(data?.name).not.toContain('Solayer')
    expect(data?.symbol).not.toBe('LAYER')
  })

  // ── 3. VALID CONTRACT IDENTITY ──────────────────────────────────────────
  it('valid contract identity: returns correctly matched data for the target chain', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'ethereum',
                baseToken: { name: 'USD Coin', symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
                priceUsd: '1.00',
                liquidity: { usd: 15000000 },
                fdv: 25000000000
              }
            ]
          })
        }
      }
      if (url.includes('token_security')) {
        return {
          ok: true,
          json: async () => ({
            code: 1,
            result: {
              '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
                token_name: 'USD Coin',
                token_symbol: 'USDC',
                total_supply: '25000000000',
                is_honeypot: '0',
                cannot_sell: '0'
              }
            }
          })
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    const data = await fetchTokenRealData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'ethereum')
    expect(data?.name).toBe('USD Coin')
    expect(data?.symbol).toBe('USDC')
    expect(data?.price).toBe(1.00)
    expect(data?.liquidity).toBe(15000000)
    expect(data?.isVerified).toBe(true)
    expect(data?.flags.length).toBe(0)
  })

  // ── 4. UNKNOWN CONTRACT WITH NO METADATA ─────────────────────────────────
  it('unknown contract: handles empty pairs and security records by returning UNKNOWN and isVerified=false', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ pairs: null, result: {} })
    }))

    const data = await fetchTokenRealData('0x000000000000000000000000000000000000dead', 'ethereum')
    expect(data?.name).toBe('Unknown Token')
    expect(data?.symbol).toBe('UNKNOWN')
    expect(data?.isVerified).toBe(false)
    expect(data?.totalSupply).toBe('N/A')
    expect(data?.liquidity).toBeNull()
  })

  // ── 5. API / PROVIDER FAILURE HANDLING ──────────────────────────────────
  it('API/provider failure: gracefully handles network fetch exceptions without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Network connection timeout'))

    const data = await fetchTokenRealData('0x1234567890123456789012345678901234567890', 'ethereum')
    expect(data).not.toBeNull()
    expect(data?.name).toBe('Unknown Token')
    expect(data?.symbol).toBe('UNKNOWN')
    expect(data?.isVerified).toBe(false)
  })

  // ── 6. MALFORMED METADATA HANDLING ──────────────────────────────────────
  it('malformed metadata: handles partial, empty, or corrupted API payloads', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'ethereum',
                baseToken: { name: '', symbol: '' },
                priceUsd: 'invalid_number'
              }
            ]
          })
        }
      }
      return {
        ok: true,
        json: async () => ({ code: 1, result: null })
      }
    })

    const data = await fetchTokenRealData('0x1234567890123456789012345678901234567890', 'ethereum')
    expect(data?.name).toBe('Unknown Token')
    expect(data?.symbol).toBe('UNKNOWN')
    expect(data?.isVerified).toBe(false)
  })

  // ── 7. MULTI-CHAIN DISAMBIGUATION (EXACT CHAIN FILTER) ───────────────────
  it('identity mismatch: accurately filters target chain when contract address exists on multiple chains', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'polygon',
                baseToken: { name: 'Polygon Bridged Token', symbol: 'POLY_TKN' },
                liquidity: { usd: 50000 }
              },
              {
                chainId: 'arbitrum',
                baseToken: { name: 'Arbitrum Native Token', symbol: 'ARB_TKN' },
                liquidity: { usd: 90000 }
              }
            ]
          })
        }
      }
      return { ok: true, json: async () => ({ result: {} }) }
    })

    const data = await fetchTokenRealData('0x9999999999999999999999999999999999999999', 'arbitrum')
    expect(data?.name).toBe('Arbitrum Native Token')
    expect(data?.symbol).toBe('ARB_TKN')
    expect(data?.isVerified).toBe(true)
  })

  // ── 8. SOLANA RUGCHECK RESOLUTION ───────────────────────────────────────
  it('solana token: successfully resolves Solana token metadata from RugCheck', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('rugcheck.xyz')) {
        return {
          ok: true,
          json: async () => ({
            tokenMeta: { name: 'Solana Verified Asset', symbol: 'SVA' },
            price: 2.50,
            totalMarketLiquidity: 450000,
            token: { supply: 1000000000000, decimals: 6 },
            creator: 'SolanaDeployerAddress1111111111111111',
            risks: [
              { level: 'warn', name: 'High Top 10 Holder Concentration', description: 'Top 10 holders own > 30%' }
            ]
          })
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    const data = await fetchTokenRealData('So11111111111111111111111111111111111111112', 'solana')
    expect(data?.name).toBe('Solana Verified Asset')
    expect(data?.symbol).toBe('SVA')
    expect(data?.price).toBe(2.50)
    expect(data?.isVerified).toBe(true)
    expect(data?.flags.length).toBe(1)
    expect(data?.flags[0].severity).toBe('MEDIUM')
  })
})

// Real-time Token & NFT Security & Metrics Fetcher using DexScreener, GoPlus & RugCheck APIs

export interface RealTokenFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
}

export interface RealTokenData {
  name: string
  symbol: string
  price: number
  liquidity: number | null
  fdv: number | null
  totalSupply: string
  creator: string
  buyTax: string
  sellTax: string
  isVerified: boolean
  flags: RealTokenFlag[]
}

interface DexPair {
  chainId?: string
  baseToken?: {
    name?: string
    symbol?: string
    address?: string
  }
  priceUsd?: string
  liquidity?: {
    usd?: number
  }
  fdv?: number
}

interface DexResponse {
  pairs?: DexPair[] | null
}

interface GoPlusTokenDetail {
  token_name?: string
  token_symbol?: string
  creator_address?: string
  buy_tax?: string
  sell_tax?: string
  total_supply?: string
  is_honeypot?: string
  cannot_sell?: string
  slippage_modifiable?: string
  transfer_pausable?: string
  is_blacklisted?: string
}

interface GoPlusTokenResponse {
  code?: number
  message?: string
  result?: Record<string, GoPlusTokenDetail>
}

interface GoPlusNftDetail {
  nft_name?: string
  nft_symbol?: string
  nft_address?: string
  creator_address?: string
  malicious_nft_contract?: number
  transfer_without_approval?: {
    value?: number
  }
  restricted_approval?: number
  self_destruct?: {
    value?: number
  }
  nft_verified?: number
}

interface GoPlusNftResponse {
  code?: number
  message?: string
  result?: GoPlusNftDetail | Record<string, GoPlusNftDetail>
}

interface RugCheckRisk {
  name?: string
  level?: string
  description?: string
}

interface RugCheckResponse {
  tokenMeta?: {
    name?: string
    symbol?: string
  }
  verification?: {
    name?: string
    symbol?: string
  }
  price?: number
  totalMarketLiquidity?: number
  totalStableLiquidity?: number
  token?: {
    supply?: string | number
    decimals?: number
  }
  creator?: string
  risks?: RugCheckRisk[]
}

const GOPLUS_CHAIN_MAP: Record<string, string> = {
  'ethereum': '1',
  'eth': '1',
  'mainnet': '1',
  'bsc': '56',
  'binance': '56',
  'polygon': '137',
  'matic': '137',
  'fantom': '250',
  'arbitrum': '42161',
  'arb': '42161',
  'avalanche': '43114',
  'avax': '43114',
  'base': '8453',
  'optimism': '10',
  'scroll': '534352',
  'linea': '59144',
  'zksync': '324',
}

const CHAIN_ALIASES: Record<string, string[]> = {
  'ethereum': ['ethereum', 'eth', '1'],
  'bsc': ['bsc', 'binance', '56'],
  'polygon': ['polygon', 'matic', '137'],
  'arbitrum': ['arbitrum', 'arb', '42161'],
  'base': ['base', '8453'],
  'solana': ['solana', 'sol'],
}

function matchesChain(pairChainId: string | undefined, selectedChain: string): boolean {
  if (!pairChainId) return false
  const pairLower = pairChainId.toLowerCase()
  const selectedLower = selectedChain.toLowerCase()
  if (pairLower === selectedLower) return true
  const aliases = CHAIN_ALIASES[selectedLower]
  if (aliases && aliases.includes(pairLower)) return true
  return false
}

export async function fetchTokenRealData(address: string, chainName: string): Promise<RealTokenData | null> {
  try {
    const cleanAddr = address.trim()
    const cleanChain = chainName.toLowerCase().trim()

    // ── SOLANA TOKEN: Fetch from RugCheck API ──────────────────────────
    if (cleanChain === 'solana' || cleanChain === 'sol' || cleanChain.includes('solana')) {
      try {
        const rcRes = await fetch(`https://api.rugcheck.xyz/v1/tokens/${cleanAddr}/report`)
        if (rcRes.ok) {
          const rcData = (await rcRes.json()) as RugCheckResponse

          const hasName = !!(rcData.tokenMeta?.name || rcData.verification?.name)
          const name = rcData.tokenMeta?.name || rcData.verification?.name || 'Unknown Token'
          const symbol = (rcData.tokenMeta?.symbol || rcData.verification?.symbol || 'UNKNOWN').toUpperCase()
          const price = rcData.price || 0
          const liquidity = rcData.totalMarketLiquidity || rcData.totalStableLiquidity || null

          let totalSupply = 'N/A'
          if (rcData.token?.supply !== undefined && rcData.token?.decimals !== undefined) {
            const rawSupply = Number(rcData.token.supply) / Math.pow(10, rcData.token.decimals)
            totalSupply = rawSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
          }

          const creator = rcData.creator || 'Solana System Program'
          const flags: RealTokenFlag[] = []

          if (rcData.risks && rcData.risks.length > 0) {
            rcData.risks.forEach((risk: RugCheckRisk) => {
              const level: RealTokenFlag['severity'] = risk.level === 'danger' ? 'HIGH' : risk.level === 'warn' ? 'MEDIUM' : 'LOW'
              flags.push({
                severity: level,
                title: risk.name || 'Risk Alert',
                description: risk.description || 'Potential security vulnerability detected.'
              })
            })
          }

          const decimals = rcData.token?.decimals || 9
          const supplyNum = Number(rcData.token?.supply || 0)
          const fdvVal = (price && supplyNum) ? (price * supplyNum / Math.pow(10, decimals)) : null

          return {
            name,
            symbol,
            price,
            liquidity,
            fdv: fdvVal,
            totalSupply,
            creator,
            buyTax: '0',
            sellTax: '0',
            isVerified: hasName,
            flags,
          }
        }
      } catch (err) {
        console.error('RugCheck API failed, checking DexScreener fallback:', err)
      }
    }

    // ── EVM / OTHER TOKENS: Fetch from DexScreener & GoPlus ───────────
    let dexData: DexResponse | null = null
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddr}`)
      if (dexRes && dexRes.ok) {
        dexData = (await dexRes.json()) as DexResponse
      }
    } catch (e) {
      console.error('DexScreener API fetch failed:', e)
    }

    const pairs = dexData?.pairs || []

    // STRICT VALIDATION: Address must be tied to the selected chain
    // Never substitute another token/project when identity resolution fails
    let bestPair: DexPair | null = null
    if (pairs && pairs.length > 0) {
      const chainPairs = pairs.filter((p: DexPair) => matchesChain(p.chainId, cleanChain))

      if (chainPairs.length > 0) {
        bestPair = [...chainPairs].sort((a: DexPair, b: DexPair) => {
          const liqA = a.liquidity?.usd || 0
          const liqB = b.liquidity?.usd || 0
          return liqB - liqA
        })[0]
      }
    }

    let isVerified = false
    let name = 'Unknown Token'
    let symbol = 'UNKNOWN'
    let price = 0
    let liquidity: number | null = null
    let fdv: number | null = null

    if (bestPair?.baseToken?.name && bestPair.baseToken.name.trim() !== '') {
      name = bestPair.baseToken.name.trim()
      symbol = (bestPair.baseToken.symbol || 'UNKNOWN').trim().toUpperCase()
      price = bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : 0
      liquidity = bestPair.liquidity?.usd ?? null
      fdv = bestPair.fdv ?? null
      isVerified = true
    }

    let creator = 'Unknown Deployer'
    let buyTax = '0'
    let sellTax = '0'
    let totalSupply = 'N/A'
    const flags: RealTokenFlag[] = []

    const goPlusChainId = GOPLUS_CHAIN_MAP[cleanChain]

    if (goPlusChainId) {
      // 1. Check GoPlus ERC-20 Token Security
      try {
        const goPlusRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${cleanAddr}`)
        if (goPlusRes && goPlusRes.ok) {
          const goPlusData = (await goPlusRes.json()) as GoPlusTokenResponse
          const details = goPlusData?.result?.[cleanAddr.toLowerCase()] || goPlusData?.result?.[cleanAddr]

          if (details && (details.token_name || details.total_supply || details.creator_address || details.is_honeypot !== undefined)) {
            if (!isVerified && details.token_name && details.token_name.trim() !== '') {
              name = details.token_name.trim()
              symbol = (details.token_symbol || 'UNKNOWN').trim().toUpperCase()
              isVerified = true
            }

            if (details.creator_address) {
              creator = details.creator_address
            }
            if (details.buy_tax) {
              buyTax = (parseFloat(details.buy_tax) * 100).toFixed(0)
            }
            if (details.sell_tax) {
              sellTax = (parseFloat(details.sell_tax) * 100).toFixed(0)
            }
            if (details.total_supply) {
              const rawSupply = parseFloat(details.total_supply)
              if (!isNaN(rawSupply) && rawSupply > 0) {
                totalSupply = rawSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
              }
            }

            if (details.is_honeypot === '1') {
              flags.push({
                severity: 'HIGH',
                title: 'Honeypot Detected',
                description: 'The contract prevents token holders from selling. You will not be able to sell this token.',
              })
            }
            if (details.cannot_sell === '1') {
              flags.push({
                severity: 'HIGH',
                title: 'Selling Blocked',
                description: 'Token transfer/sell function is disabled or restricted to certain addresses.',
              })
            }
            if (details.slippage_modifiable === '1') {
              flags.push({
                severity: 'MEDIUM',
                title: 'Modifiable Slippage / Tax',
                description: 'The owner has the ability to change transfer fees or taxes at any time, up to 100%.',
              })
            }
            if (details.transfer_pausable === '1') {
              flags.push({
                severity: 'MEDIUM',
                title: 'Transfer Pausable',
                description: 'The contract owner can pause all token transfers, preventing trading completely.',
              })
            }
            if (details.is_blacklisted === '1') {
              flags.push({
                severity: 'HIGH',
                title: 'Blacklist Function',
                description: 'The contract contains blacklist logic that allows blocking specific wallets from trading.',
              })
            }
          }
        }
      } catch (e) {
        console.error('GoPlus Security API fetch failed:', e)
      }

      // 2. Check GoPlus NFT Security (e.g. for Rally NFT or other ERC-721/1155 contracts)
      if (!isVerified || creator === 'Unknown Deployer') {
        try {
          const nftRes = await fetch(`https://api.gopluslabs.io/api/v1/nft_security/${goPlusChainId}?contract_addresses=${cleanAddr}`)
          if (nftRes && nftRes.ok) {
            const nftData = (await nftRes.json()) as GoPlusNftResponse
            let nftResult: GoPlusNftDetail | undefined
            if (nftData?.result) {
              if ('nft_address' in nftData.result) {
                nftResult = nftData.result as GoPlusNftDetail
              } else if (typeof nftData.result === 'object') {
                const map = nftData.result as Record<string, GoPlusNftDetail>
                nftResult = map[cleanAddr.toLowerCase()] || map[cleanAddr]
              }
            }

            if (nftResult && (nftResult.nft_name || nftResult.nft_symbol || nftResult.nft_address)) {
              if (!isVerified && (nftResult.nft_name || nftResult.nft_symbol)) {
                name = (nftResult.nft_name || name).trim()
                symbol = (nftResult.nft_symbol || symbol).trim().toUpperCase()
                isVerified = true
              }
              if (nftResult.creator_address) {
                creator = nftResult.creator_address
              }
              if (nftResult.malicious_nft_contract === 1) {
                flags.push({
                  severity: 'HIGH',
                  title: 'Malicious NFT Contract',
                  description: 'Contract flagged as malicious NFT in security intelligence database.',
                })
              }
              if (nftResult.transfer_without_approval?.value === 1) {
                flags.push({
                  severity: 'HIGH',
                  title: 'Transfer Without Approval',
                  description: 'Owner or operator can transfer user NFTs without explicit approval.',
                })
              }
              if (nftResult.restricted_approval === 1) {
                flags.push({
                  severity: 'MEDIUM',
                  title: 'Restricted Approval',
                  description: 'Contract restricts standard NFT approvals.',
                })
              }
              if (nftResult.self_destruct?.value === 1) {
                flags.push({
                  severity: 'HIGH',
                  title: 'Self Destruct Logic',
                  description: 'Contract contains selfdestruct instruction which can destroy contract logic.',
                })
              }
            }
          }
        } catch (e) {
          console.error('GoPlus NFT Security API fetch failed:', e)
        }
      }
    }

    if (totalSupply === 'N/A' && fdv && price > 0) {
      const calcSupply = fdv / price
      totalSupply = calcSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
    }

    if (creator === 'Unknown Deployer' && isVerified) {
      if (cleanChain === 'solana') {
        creator = 'Solana System Program'
      } else {
        creator = address.slice(0, 10) + '...' + address.slice(-8)
      }
    }

    return {
      name,
      symbol,
      price,
      liquidity,
      fdv,
      totalSupply,
      creator,
      buyTax,
      sellTax,
      isVerified,
      flags,
    }
  } catch (err) {
    console.error('Error in fetchTokenRealData:', err)
    return null
  }
}

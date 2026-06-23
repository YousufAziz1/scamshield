// Real-time Token Security & Metrics Fetcher using DexScreener, GoPlus & RugCheck APIs

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
  flags: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; description: string }>
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

export async function fetchTokenRealData(address: string, chainName: string): Promise<RealTokenData | null> {
  try {
    const cleanAddr = address.trim()
    const cleanChain = chainName.toLowerCase().trim()

    // ── SOLANA TOKEN: Fetch from RugCheck API ──────────────────────────
    if (cleanChain === 'solana' || cleanChain === 'sol' || cleanChain.includes('solana')) {
      try {
        const rcRes = await fetch(`https://api.rugcheck.xyz/v1/tokens/${cleanAddr}/report`)
        if (rcRes.ok) {
          const rcData = await rcRes.json()
          
          const name = rcData.tokenMeta?.name || rcData.verification?.name || 'Unknown Token'
          const symbol = (rcData.tokenMeta?.symbol || rcData.verification?.symbol || 'TOKEN').toUpperCase()
          const price = rcData.price || 0
          const liquidity = rcData.totalMarketLiquidity || rcData.totalStableLiquidity || null
          
          let totalSupply = '1,000,000,000'
          if (rcData.token?.supply && rcData.token?.decimals !== undefined) {
            const rawSupply = Number(rcData.token.supply) / Math.pow(10, rcData.token.decimals)
            totalSupply = rawSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
          }
          
          const creator = rcData.creator || 'Solana System Program'
          const flags: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; description: string }> = []
          
          if (rcData.risks && rcData.risks.length > 0) {
            rcData.risks.forEach((risk: any) => {
              const level = risk.level === 'danger' ? 'HIGH' : risk.level === 'warn' ? 'MEDIUM' : 'LOW'
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
            flags,
          }
        }
      } catch (err) {
        console.error('RugCheck API failed, falling back to DexScreener:', err)
      }
    }

    // ── EVM / OTHER TOKENS: Fetch from DexScreener & GoPlus ───────────
    let dexData: any = null
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddr}`)
      if (dexRes.ok) {
        dexData = await dexRes.json()
      }
    } catch (e) {
      console.error('DexScreener API fetch failed:', e)
    }

    const pairs = dexData?.pairs || []
    
    // Sort pairs by liquidity descending to ensure we pick the main pool!
    let bestPair = null
    if (pairs.length > 0) {
      const chainPairs = pairs.filter((p: any) => p.chainId === cleanChain)
      const targetPairs = chainPairs.length > 0 ? chainPairs : pairs
      
      bestPair = [...targetPairs].sort((a: any, b: any) => {
        const liqA = a.liquidity?.usd || 0
        const liqB = b.liquidity?.usd || 0
        return liqB - liqA
      })[0]
    } else {
      bestPair = pairs[0]
    }

    const name = bestPair?.baseToken?.name || 'Unknown Token'
    const symbol = bestPair?.baseToken?.symbol || 'TOKEN'
    const price = bestPair?.priceUsd ? parseFloat(bestPair?.priceUsd) : 0
    const liquidity = bestPair?.liquidity?.usd || null
    const fdv = bestPair?.fdv || null

    let creator = 'Unknown Deployer'
    let buyTax = '0'
    let sellTax = '0'
    let totalSupply = '0'
    const flags: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; description: string }> = []

    const goPlusChainId = GOPLUS_CHAIN_MAP[cleanChain] || GOPLUS_CHAIN_MAP[bestPair?.chainId]

    if (goPlusChainId) {
      try {
        const goPlusRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${cleanAddr}`)
        if (goPlusRes.ok) {
          const goPlusData = await goPlusRes.json()
          const details = goPlusData?.result?.[cleanAddr.toLowerCase()] || goPlusData?.result?.[Object.keys(goPlusData?.result || {})[0]]
          
          if (details) {
            creator = details.creator_address || creator
            buyTax = details.buy_tax ? (parseFloat(details.buy_tax) * 100).toFixed(0) : '0'
            sellTax = details.sell_tax ? (parseFloat(details.sell_tax) * 100).toFixed(0) : '0'
            
            if (details.total_supply) {
              const rawSupply = parseFloat(details.total_supply)
              totalSupply = rawSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
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
    }

    if (totalSupply === '0' && fdv && price > 0) {
      const calcSupply = fdv / price
      totalSupply = calcSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
    } else if (totalSupply === '0') {
      totalSupply = '1,000,000,000'
    }

    if (creator === 'Unknown Deployer') {
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
      flags,
    }
  } catch (err) {
    console.error('Error in fetchTokenRealData:', err)
    return null
  }
}

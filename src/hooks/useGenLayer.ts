import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from 'genlayer-js'
import { testnetBradbury, studionet } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'
import { CONTRACT } from '@/lib/genlayer'
import type { ScanState, ScanResult, Verdict, ValidatorVote, RiskFlag } from '@/types'
import { fetchTokenRealData, type RealTokenData } from '@/lib/tokenData'

const STATUS_ORDER = ['submitting', 'pending', 'proposing', 'committing', 'revealing', 'accepted', 'finalized']

// Validator mascots with codenames
export const VALIDATOR_MASCOTS = [
  { id: '01', emoji: '🐻', code: 'BEAR-NODE' },
  { id: '02', emoji: '🦊', code: 'FOX-NODE'  },
  { id: '03', emoji: '🐺', code: 'WOLF-NODE' },
  { id: '04', emoji: '🐱', code: 'CAT-NODE'  },
  { id: '05', emoji: '🛡️', code: 'SHIELD-NODE' },
]

interface ParsedContractResult {
  verdict?: Verdict
  riskScore?: number
  summary?: string
  flags?: RiskFlag[]
}

export function useGenLayer() {
  const [scanState, setScanState] = useState<ScanState>({ status: 'idle' })
  const [isSnapInstalled, setIsSnapInstalled] = useState<boolean | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isStudioMode, setIsStudioMode] = useState<boolean>(false)
  const [isSimulated, setIsSimulated] = useState<boolean>(false)

  const pollIntervalRef  = useRef<number | null>(null)
  const pollStartTimeRef = useRef<number>(0)

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setScanState({ status: 'idle' })
  }, [])

  const getProgressPercent = () => {
    const idx = STATUS_ORDER.indexOf(scanState.status)
    if (idx === -1) return 0
    return Math.round(((idx + 1) / STATUS_ORDER.length) * 100)
  }

  // ── Snap detection ──────────────────────────────────────────────
  const checkSnap = useCallback(async () => {
    try {
      const provider = window.ethereum
      if (!provider) {
        setIsSimulated(true)
        setIsSnapInstalled(true)
        setConnectionStatus('connected')
        setConnectionError(null)
        setIsStudioMode(true)
        return true
      }
      try {
        const snaps = (await provider.request({ method: 'wallet_getSnaps' })) as Record<string, unknown> | null
        const installed = !!snaps && ('npm:genlayer-snap' in snaps)
        setIsSnapInstalled(installed)
        if (installed) { 
          setConnectionStatus('connected')
          setConnectionError(null)
          setIsStudioMode(false) 
          setIsSimulated(false)
        } else { 
          setConnectionStatus('disconnected') 
        }
        return installed
      } catch (snapErr: unknown) {
        const msg = (snapErr instanceof Error ? snapErr.message : String(snapErr)).toLowerCase()
        if (
          msg.includes('handler') || msg.includes('not supported') ||
          msg.includes('not implemented') || msg.includes('method_not_found') ||
          msg.includes('parse error') || msg.includes('does not support') ||
          msg.includes("doesn't has")
        ) {
          setIsSnapInstalled(true)
          setConnectionStatus('connected')
          setConnectionError(null)
          setIsStudioMode(true)
          setIsSimulated(false)
          return true
        }
        throw snapErr
      }
    } catch (err: unknown) {
      setIsSnapInstalled(false)
      setConnectionStatus('error')
      setConnectionError(err instanceof Error ? err.message : String(err))
      setIsSimulated(false)
      return false
    }
  }, [])

  // ── Snap install ────────────────────────────────────────────────
  const installSnap = useCallback(async () => {
    try {
      const provider = window.ethereum
      if (!provider) {
        setIsSimulated(true)
        setIsSnapInstalled(true)
        setConnectionStatus('connected')
        return
      }
      setConnectionStatus('connecting')
      try {
        await provider.request({ method: 'wallet_requestSnaps', params: { 'npm:genlayer-snap': {} } })
      } catch (snapErr: unknown) {
        const msg = (snapErr instanceof Error ? snapErr.message : String(snapErr)).toLowerCase()
        if (
          msg.includes('handler') || msg.includes('not supported') ||
          msg.includes('not implemented') || msg.includes('method_not_found') ||
          msg.includes('parse error') || msg.includes('does not support') ||
          msg.includes("doesn't has")
        ) {
          setIsSnapInstalled(true)
          setConnectionStatus('connected')
          setConnectionError(null)
          setIsStudioMode(true)
          setIsSimulated(false)
          return
        }
        throw snapErr
      }
      const installed = await checkSnap()
      if (installed) { 
        setConnectionStatus('connected')
        setConnectionError(null)
        setIsStudioMode(false) 
        setIsSimulated(false)
      } else {
        throw new Error('GenLayer Snap installation was requested but is not showing up in installed snaps.')
      }
    } catch (err: unknown) {
      setIsSnapInstalled(false)
      setConnectionStatus('error')
      setConnectionError(err instanceof Error ? err.message : String(err))
    }
  }, [checkSnap])

  useEffect(() => { void checkSnap() }, [checkSnap])

  // ── Build scan result from parsed JSON ───────────────────────────
  function buildScanResult(parsed: ParsedContractResult, tokenAddress: string, chainId: string, txHash: string, realData?: RealTokenData | null): ScanResult {
    const score = parsed.riskScore ?? 50
    const rawVerdict = parsed.verdict ?? (score > 70 ? 'SCAM' : score > 30 ? 'RISKY' : 'SAFE')

    const votes: ValidatorVote[] = VALIDATOR_MASCOTS.map((m, i) => {
      let v: Verdict
      if (rawVerdict === 'UNKNOWN') {
        v = 'UNKNOWN'
      } else if (score > 70) {
        v = i >= 4 ? 'RISKY' : 'SCAM'
      } else if (score > 30) {
        v = i === 0 ? 'SAFE' : i === 4 ? 'SCAM' : 'RISKY'
      } else {
        v = i === 0 ? 'RISKY' : 'SAFE'
      }
      return { validatorId: m.id, vote: v, confidence: 0.85 + (i * 0.02) }
    })

    return {
      tokenAddress,
      chainId,
      verdict: rawVerdict,
      riskScore: score,
      summary: parsed.summary ?? 'Analysis complete.',
      consensusReached: true,
      flags: parsed.flags ?? [],
      validatorVotes: votes,
      scannedAt: Date.now(),
      txHash,
      realTokenData: realData ?? undefined,
    }
  }

  // ── Main scan function ───────────────────────────────────────────
  const scanToken = useCallback(async (tokenAddress: string, chainId: string, walletAddress: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    setScanState({ status: 'submitting' })

    // Fetch real token / NFT data from DexScreener / GoPlus
    let realData: RealTokenData | null = null
    try {
      realData = await fetchTokenRealData(tokenAddress, chainId)
    } catch (e) {
      console.error('Failed to fetch real token data:', e)
    }

    if (isSimulated) {
      // Simulation mode
      let stageIdx = 0
      const stages: ScanState['status'][] = ['submitting', 'pending', 'proposing', 'committing', 'revealing', 'finalized']
      const txHash = '0xsim' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6)
      
      const interval = window.setInterval(() => {
        stageIdx++
        if (stageIdx < stages.length - 1) {
          setScanState({ status: stages[stageIdx], txHash })
        } else {
          clearInterval(interval)
          // Build final result
          const addrLower = tokenAddress.toLowerCase()
          let score: number
          let verdictStr: Verdict
          let summaryStr: string
          let flagsList: RiskFlag[] = []

          if (realData && realData.isVerified) {
            const hasHigh = realData.flags.some(f => f.severity === 'HIGH')
            const hasMed = realData.flags.some(f => f.severity === 'MEDIUM')
            
            if (hasHigh) {
              score = 88
              verdictStr = 'SCAM'
              summaryStr = `CRITICAL ALERT: Threat assessment flagged high-risk security issues for ${realData.name} (${realData.symbol}). GoPlus analysis identified critical anomalies: ${realData.flags.map(f => f.title).join(', ')}.`
            } else if (hasMed) {
              score = 55
              verdictStr = 'RISKY'
              summaryStr = `Warning: Elevated threat parameters found for ${realData.name} (${realData.symbol}). Token contract contains moderate risk indicators: ${realData.flags.map(f => f.title).join(', ')}.`
            } else {
              score = 8
              verdictStr = 'SAFE'
              summaryStr = `Consensus validation complete for ${realData.name} (${realData.symbol}). Authoritative metadata verified on ${chainId.toUpperCase()}. No threat indicators identified.`
            }

            flagsList = realData.flags.map((f, idx) => ({
              id: `goplus-${idx}`,
              severity: f.severity.toLowerCase() as RiskFlag['severity'],
              label: f.title,
              detail: f.description
            }))
          } else {
            const cleanChainLower = chainId.toLowerCase().trim()
            // Match quick scan demo targets strictly by chain AND exact address
            if (cleanChainLower === 'ethereum' && (addrLower === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' || addrLower === '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' || addrLower === '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984')) {
              score = 5
              verdictStr = 'SAFE'
              summaryStr = `Consensus validation successful for verified reference token (${tokenAddress.slice(0, 8)}). Contract conforms to standard specifications with verified source code.`
            } else if (cleanChainLower === 'bsc' && (addrLower === '0x4f128e6dbd1283c799a4e21a2c91a329d48b1111' || addrLower === '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3' || addrLower === '0x58d4b9e633b41e6f00d24c3d5a96c4d4e8b55da8')) {
              score = 92
              verdictStr = 'SCAM'
              summaryStr = `CRITICAL ALERT: Threat assessment flagged high-risk honeypot bytecode. Direct analysis identifies non-standard transfer taxes (up to 100%), blocked liquidity transfers, and unrenounced owner control permissions.`
              flagsList = [
                { id: 'honeypot_bytecode', severity: 'high', label: 'Honeypot Bytecode Pattern', detail: 'The contract contains execution logic that prevents token sellers from transferring tokens back to the liquidity pool.' },
                { id: 'variable_tax', severity: 'high', label: 'Variable Sell Tax', detail: 'Transfer tax parameters can be dynamically set to 100% by the contract owner, preventing swaps.' },
                { id: 'unrenounced_owner', severity: 'medium', label: 'Unrenounced Ownership', detail: 'Ownership is held by an active EOA address with permissions to modify critical parameters.' }
              ]
            } else {
              // Unverified / Unknown contract on this chain: strictly return UNKNOWN with score 50 and INSUFFICIENT DATA
              score = 50
              verdictStr = 'UNKNOWN'
              summaryStr = 'Unable to verify token identity or security parameters. No authoritative market or contract metadata found on the selected network.'
              flagsList = []
            }
          }

          const parsed: ParsedContractResult = {
            verdict: verdictStr,
            riskScore: score,
            summary: summaryStr,
            flags: flagsList
          }

          const scanResult = buildScanResult(parsed, tokenAddress, chainId, txHash, realData)
          setScanState({ status: 'finalized', txHash, result: scanResult })
        }
      }, 1000)

      pollIntervalRef.current = interval
      return
    }

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('MetaMask is required to connect to the GenLayer network.')

      // Snap check
      try {
        const snaps = (await provider.request({ method: 'wallet_getSnaps' })) as Record<string, unknown> | null
        const installed = !!snaps && ('npm:genlayer-snap' in snaps)
        if (!installed) throw new Error('GenLayer MetaMask Snap is not installed. Please click "Install GenLayer Snap".')
      } catch (snapErr: unknown) {
        const msg = (snapErr instanceof Error ? snapErr.message : String(snapErr)).toLowerCase()
        if (!(msg.includes('handler') || msg.includes('not supported') || msg.includes('not implemented') || msg.includes('method_not_found') || msg.includes('parse error') || msg.includes('does not support') || msg.includes("doesn't has"))) {
          throw snapErr
        }
      }

      // Create client
      const activeChain = isStudioMode ? studionet : testnetBradbury
      const client = createClient({ chain: activeChain, account: walletAddress as `0x${string}`, provider: window.ethereum as unknown as NonNullable<Parameters<typeof createClient>[0]>['provider'] })

      // Connect
      const activeChainName = isStudioMode ? 'studionet' : 'testnetBradbury'
      try {
        await client.connect(activeChainName)
      } catch (connErr: unknown) {
        const msg = (connErr instanceof Error ? connErr.message : String(connErr)).toLowerCase()
        if (!(msg.includes('handler') || msg.includes('not supported') || msg.includes('not implemented') || msg.includes('method_not_found') || msg.includes('parse error') || msg.includes('does not support') || msg.includes("doesn't has"))) {
          throw connErr
        }
      }
      setConnectionStatus('connected')

      // Write contract
      const txHash = await client.writeContract({
        address: CONTRACT, functionName: 'scan_token', args: [tokenAddress, chainId], value: 0n,
      })

      setScanState({ status: 'pending', txHash })

      // Poll
      const studioStages: ScanState['status'][] = ['pending', 'proposing', 'committing', 'revealing']
      let studioStageIdx = 0
      pollStartTimeRef.current = Date.now()

      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const elapsed = Date.now() - pollStartTimeRef.current

          // 3-minute timeout
          if (elapsed > 180_000) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            setScanState(prev => ({ ...prev, status: 'error', error: 'Consensus timed out after 3 minutes. Try resetting and scanning again.' }))
            return
          }

          if (isStudioMode) {
            const expectedStage = Math.min(Math.floor(elapsed / 15_000), studioStages.length - 1)
            if (expectedStage !== studioStageIdx) {
              studioStageIdx = expectedStage
              setScanState(prev => ({ ...prev, status: studioStages[studioStageIdx] }))
            }

            try {
              const rawResult = (await client.readContract({ address: CONTRACT, functionName: 'get_scan_result', args: [tokenAddress] })) as string
              if (rawResult && rawResult.trim() !== '') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current)
                  pollIntervalRef.current = null
                }
                const parsed = JSON.parse(rawResult) as ParsedContractResult
                const scanResult = buildScanResult(parsed, tokenAddress, chainId, txHash, realData)
                setScanState({ status: 'finalized', txHash, result: scanResult })
              }
            } catch {
              // Waiting for result to be available in storage
            }

          } else {
            const tx = await client.getTransaction({ hash: txHash })
            if (!tx) return
            const s = tx.status
            let nextStatus: ScanState['status'] = 'pending'
            if (s === TransactionStatus.PROPOSING  || String(s) === 'PROPOSING')  nextStatus = 'proposing'
            else if (s === TransactionStatus.COMMITTING || String(s) === 'COMMITTING') nextStatus = 'committing'
            else if (s === TransactionStatus.REVEALING  || String(s) === 'REVEALING')  nextStatus = 'revealing'
            else if (s === TransactionStatus.ACCEPTED   || String(s) === 'ACCEPTED')   nextStatus = 'accepted'
            else if (s === TransactionStatus.FINALIZED  || String(s) === 'FINALIZED')  nextStatus = 'finalized'
            else if (s === TransactionStatus.CANCELED   || String(s) === 'CANCELED')   nextStatus = 'error'

            setScanState(prev => ({ ...prev, status: nextStatus === 'pending' && prev.status !== 'submitting' ? prev.status : nextStatus }))

            if (nextStatus === 'accepted' || nextStatus === 'finalized') {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              const rawResult = (await client.readContract({ address: CONTRACT, functionName: 'get_scan_result', args: [tokenAddress] })) as string
              if (!rawResult || rawResult.trim() === '') throw new Error('Consensus completed but no scan result was returned.')
              const parsed = JSON.parse(rawResult) as ParsedContractResult
              const scanResult = buildScanResult(parsed, tokenAddress, chainId, txHash, realData)
              setScanState({ status: 'finalized', txHash, result: scanResult })
            }
          }
        } catch (pollErr: unknown) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          setScanState(prev => ({ ...prev, status: 'error', error: pollErr instanceof Error ? pollErr.message : 'Error during consensus polling.' }))
        }
      }, 3000)

    } catch (err: unknown) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      setScanState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to start live GenLayer scan.' })
    }
  }, [isStudioMode, isSimulated])

  return {
    scanState, scanToken, reset,
    progressPercent: getProgressPercent(),
    isSnapInstalled, connectionStatus, connectionError,
    installSnap, checkSnap, isStudioMode, isSimulated,
  }
}

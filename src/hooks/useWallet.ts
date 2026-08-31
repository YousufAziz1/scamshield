import { useState, useCallback, useEffect } from 'react'
import { testnetBradbury } from 'genlayer-js/chains'

export interface WalletState {
  address: string | null
  isConnecting: boolean
  error: string | null
}

interface RpcError extends Error {
  code?: number
}

interface EthereumWindow {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>
    on: (event: string, callback: (...args: unknown[]) => void) => void
    removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
  }
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(
    () => {
      const saved = localStorage.getItem('scamshield_wallet')
      const fallback = (typeof window === 'undefined' || !(window as unknown as EthereumWindow).ethereum) 
        ? '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' 
        : null
      return {
        address: saved || fallback || null,
        isConnecting: false,
        error: null,
      }
    }
  )

  const connect = useCallback(async () => {
    const eth = (window as unknown as EthereumWindow).ethereum
    if (typeof window === 'undefined' || !eth) {
      const mockAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
      localStorage.setItem('scamshield_wallet', mockAddress)
      setWallet({
        address: mockAddress,
        isConnecting: false,
        error: null,
      })
      return
    }

    setWallet(prev => ({ ...prev, isConnecting: true, error: null }))
    try {
      // Request account access
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned')
      }
      
      const address = accounts[0]
      localStorage.setItem('scamshield_wallet', address)
      setWallet({
        address,
        isConnecting: false,
        error: null,
      })

      // Switch chain to Bradbury testnet if needed
      const chainIdHex = `0x${testnetBradbury.id.toString(16)}`
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch (switchError: unknown) {
        const rpcErr = switchError as RpcError
        // If the chain hasn't been added, add it
        if (rpcErr.code === 4902) {
          try {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: chainIdHex,
                  chainName: testnetBradbury.name,
                  nativeCurrency: testnetBradbury.nativeCurrency,
                  rpcUrls: testnetBradbury.rpcUrls.default.http,
                  blockExplorerUrls: testnetBradbury.blockExplorers?.default.url ? [testnetBradbury.blockExplorers.default.url] : [],
                },
              ],
            })
          } catch (addError) {
            console.error('Failed to add network', addError)
          }
        } else {
          console.error('Failed to switch network', switchError)
        }
      }
    } catch (err: unknown) {
      setWallet(prev => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }))
    }
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem('scamshield_wallet')
    setWallet({
      address: null,
      isConnecting: false,
      error: null,
    })
  }, [])

  // Listen for account changes
  useEffect(() => {
    const eth = (window as unknown as EthereumWindow).ethereum
    if (typeof window === 'undefined' || !eth) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (!accs || accs.length === 0) {
        disconnect()
      } else {
        localStorage.setItem('scamshield_wallet', accs[0])
        setWallet({
          address: accs[0],
          isConnecting: false,
          error: null,
        })
      }
    }

    const handleChainChanged = () => {
      window.location.reload()
    }

    eth.on('accountsChanged', handleAccountsChanged)
    eth.on('chainChanged', handleChainChanged)

    return () => {
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccountsChanged)
        eth.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [disconnect])

  return {
    wallet,
    connect,
    disconnect,
  }
}

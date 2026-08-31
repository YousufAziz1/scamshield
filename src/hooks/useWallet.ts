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
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
  })

  // Synchronize with active MetaMask accounts on mount
  useEffect(() => {
    const eth = (window as unknown as EthereumWindow).ethereum
    if (!eth) return

    eth.request({ method: 'eth_accounts' })
      .then(accounts => {
        const accs = accounts as string[]
        if (accs && accs.length > 0) {
          setWallet({
            address: accs[0],
            isConnecting: false,
            error: null,
          })
        }
      })
      .catch(err => {
        console.warn('Initial eth_accounts check failed:', err)
      })
  }, [])

  const connect = useCallback(async (): Promise<string | null> => {
    const eth = (window as unknown as EthereumWindow).ethereum
    if (!eth) {
      const errMsg = 'MetaMask or an EIP-1193 compatible Web3 wallet was not detected. Please install a Web3 browser wallet extension.'
      setWallet({
        address: null,
        isConnecting: false,
        error: errMsg,
      })
      return null
    }

    setWallet(prev => ({ ...prev, isConnecting: true, error: null }))
    try {
      // Request user account authorization
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts authorized in wallet.')
      }

      const address = accounts[0]
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
        // If chain 4902 is missing, add GenLayer testnet
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
            console.warn('Failed to add GenLayer network to wallet:', addError)
          }
        }
      }

      return address
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const userRejected = msg.includes('4001') || msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')
      const displayError = userRejected
        ? 'Wallet connection request was rejected in your wallet.'
        : `Wallet connection failed: ${msg}`

      setWallet({
        address: null,
        isConnecting: false,
        error: displayError,
      })
      return null
    }
  }, [])

  const disconnect = useCallback(() => {
    setWallet({
      address: null,
      isConnecting: false,
      error: null,
    })
  }, [])

  // Listen for account and chain change events from provider
  useEffect(() => {
    const eth = (window as unknown as EthereumWindow).ethereum
    if (!eth) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (!accs || accs.length === 0) {
        disconnect()
      } else {
        setWallet({
          address: accs[0],
          isConnecting: false,
          error: null,
        })
      }
    }

    const handleChainChanged = () => {
      // Reload on network switch to re-initialize contracts cleanly
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

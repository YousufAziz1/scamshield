import { useState, useCallback, useEffect } from 'react'
import { testnetBradbury } from 'genlayer-js/chains'

export interface WalletState {
  address: string | null
  isConnecting: boolean
  error: string | null
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(
    () => {
      const saved = localStorage.getItem('scamshield_wallet')
      const fallback = (typeof window === 'undefined' || !window.ethereum) 
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
    if (typeof window === 'undefined' || !window.ethereum) {
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
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      if (accounts.length === 0) {
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
      // Bradbury testnet chain ID is usually 14211 or similar, we can check from testnetBradbury.id
      const chainIdHex = `0x${testnetBradbury.id.toString(16)}`
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch (switchError: any) {
        // If the chain hasn't been added, add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
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
    } catch (err: any) {
      setWallet(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || 'Connection failed',
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
    if (typeof window === 'undefined' || !window.ethereum) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
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
      // Reload page or re-verify
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [disconnect])

  return {
    wallet,
    connect,
    disconnect,
  }
}

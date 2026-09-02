const ACTIVE_CONTRACT = '0x5802c5AE337b7c79723beC9d0017C32DCAec12b7' as const
const envAddr = import.meta.env.VITE_CONTRACT_ADDRESS

export const CONTRACT = ((envAddr && envAddr !== '0x786214309e075841fe701bF240562e8417389ebF')
  ? envAddr
  : ACTIVE_CONTRACT) as `0x${string}`
export const RPC_URL = import.meta.env.VITE_GENLAYER_RPC || 'https://studio.genlayer.com/api'

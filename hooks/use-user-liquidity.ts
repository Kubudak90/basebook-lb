import { useAccount, useReadContracts } from "wagmi"
import { useMemo } from "react"
import { LBPairABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"

export interface UserLiquidityPosition {
  binId: number
  balance: bigint
  amountX: bigint
  amountY: bigint
  binReserveX: bigint
  binReserveY: bigint
  price: number
}

export function useUserLiquidity(poolPairAddress: `0x${string}` | undefined) {
  const { address } = useAccount()

  // First, get the active ID
  const { data: activeIdData } = useReadContracts({
    contracts: poolPairAddress
      ? [
          {
            address: poolPairAddress,
            abi: LBPairABI,
            functionName: "getActiveId",
            chainId: baseSepolia.id,
          },
        ]
      : [],
  })

  const activeId = activeIdData?.[0]?.status === "success"
    ? Number(activeIdData[0].result)
    : undefined

  // Generate bin IDs to check (±50 bins around active)
  const binIdsToCheck = useMemo(() => {
    if (!activeId) return []
    const range = 50
    const ids: number[] = []
    for (let i = -range; i <= range; i++) {
      ids.push(activeId + i)
    }
    return ids
  }, [activeId])

  // Batch fetch balances for all bin IDs
  const balanceContracts = useMemo(() => {
    if (!poolPairAddress || !address || binIdsToCheck.length === 0) return []

    return binIdsToCheck.map((binId) => ({
      address: poolPairAddress,
      abi: LBPairABI,
      functionName: "balanceOf" as const,
      args: [address, BigInt(binId)],
      chainId: baseSepolia.id,
    }))
  }, [poolPairAddress, address, binIdsToCheck])

  const { data: balanceData, isLoading: isLoadingBalances } = useReadContracts({
    contracts: balanceContracts,
  })

  // Batch fetch bin reserves for bins with non-zero balance
  const binReserveContracts = useMemo(() => {
    if (!poolPairAddress || !balanceData) return []

    const binsWithBalance = binIdsToCheck.filter((binId, index) => {
      const balance = balanceData[index]
      return balance?.status === "success" && balance.result && balance.result > BigInt(0)
    })

    return binsWithBalance.map((binId) => ({
      address: poolPairAddress,
      abi: LBPairABI,
      functionName: "getBin" as const,
      args: [binId],
      chainId: baseSepolia.id,
    }))
  }, [poolPairAddress, balanceData, binIdsToCheck])

  const { data: binReserveData, isLoading: isLoadingReserves } = useReadContracts({
    contracts: binReserveContracts,
  })

  // Combine all data into positions
  const positions = useMemo(() => {
    if (!balanceData || !activeId) return []

    const result: UserLiquidityPosition[] = []
    let reserveIndex = 0

    binIdsToCheck.forEach((binId, index) => {
      const balanceResult = balanceData[index]

      if (balanceResult?.status === "success" && balanceResult.result && balanceResult.result > BigInt(0)) {
        const balance = balanceResult.result

        // Get bin reserves
        const reserveResult = binReserveData?.[reserveIndex]
        let binReserveX = BigInt(0)
        let binReserveY = BigInt(0)

        if (reserveResult?.status === "success" && Array.isArray(reserveResult.result)) {
          binReserveX = BigInt(reserveResult.result[0])
          binReserveY = BigInt(reserveResult.result[1])
        }

        // Calculate user's share of reserves
        // In LB, liquidity shares are fungible within each bin
        // User amount = (user balance / total supply of bin) * bin reserves
        // For simplicity, we'll just show the balance as the amount for now
        // TODO: Calculate actual share based on total supply

        // Calculate price from bin ID
        // price = (1 + binStep/10000)^(binId - 2^23)
        const binStep = 25 // You should fetch this from the pool
        const priceBase = 1 + binStep / 10000
        const pricePower = binId - 8388608 // 2^23
        const price = Math.pow(priceBase, pricePower)

        result.push({
          binId,
          balance,
          amountX: balance, // Simplified - actual calculation needed
          amountY: balance, // Simplified - actual calculation needed
          binReserveX,
          binReserveY,
          price,
        })

        reserveIndex++
      }
    })

    return result.sort((a, b) => a.binId - b.binId)
  }, [balanceData, binReserveData, binIdsToCheck, activeId])

  return {
    positions,
    activeId,
    isLoading: isLoadingBalances || isLoadingReserves,
  }
}

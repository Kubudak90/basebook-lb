import { useReadContracts } from "wagmi"
import { CONTRACTS } from "@/lib/contracts/addresses"
import { LBFactoryABI, LBPairABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"
import { useEffect, useState } from "react"

interface UseSwapQuoteParams {
    tokenX: `0x${string}` | undefined
    tokenY: `0x${string}` | undefined
    amountIn: bigint | undefined
    binStep?: number
}

export function useSwapQuote({ tokenX, tokenY, amountIn, binStep = 25 }: UseSwapQuoteParams) {
    const [pairAddress, setPairAddress] = useState<`0x${string}` | undefined>()

    // Step 1: Get pair address from factory
    const { data: pairData } = useReadContracts({
        contracts: tokenX && tokenY ? [
            {
                address: CONTRACTS.LBFactory as `0x${string}`,
                abi: LBFactoryABI,
                functionName: "getLBPairInformation",
                args: [tokenX, tokenY, binStep],
                chainId: baseSepolia.id,
            }
        ] : [],
    })

    // Extract pair address
    useEffect(() => {
        if (pairData?.[0]?.status === "success") {
            const pairInfo = pairData[0].result as {
                binStep: number
                LBPair: `0x${string}`
                createdByOwner: boolean
                ignoredForRouting: boolean
            }
            if (pairInfo.LBPair && pairInfo.LBPair !== "0x0000000000000000000000000000000000000000") {
                setPairAddress(pairInfo.LBPair)
            } else {
                setPairAddress(undefined)
            }
        }
    }, [pairData])

    // Step 2: Get swap quote from pair
    const { data: quoteData, isLoading } = useReadContracts({
        contracts: pairAddress && tokenX && tokenY && amountIn && amountIn > 0n ? [
            {
                address: pairAddress,
                abi: LBPairABI,
                functionName: "getTokenX",
                chainId: baseSepolia.id,
            },
            {
                address: pairAddress,
                abi: LBPairABI,
                functionName: "getSwapOut",
                args: [amountIn, tokenX < tokenY], // swapForY = tokenX < tokenY
                chainId: baseSepolia.id,
            }
        ] : [],
    })

    const tokenXFromPair = quoteData?.[0]?.status === "success" ? quoteData[0].result : undefined
    const swapResult = quoteData?.[1]?.status === "success" ? quoteData[1].result : undefined

    // Determine swap direction
    const swapForY = tokenXFromPair === tokenX

    if (!swapResult || !pairAddress) {
        return {
            amountOut: undefined,
            amountInLeft: undefined,
            fee: undefined,
            isLoading,
            pairAddress: undefined,
        }
    }

    const [amountInLeft, amountOut, fee] = swapResult as readonly [bigint, bigint, bigint]

    return {
        amountOut,
        amountInLeft,
        fee,
        isLoading,
        pairAddress,
    }
}

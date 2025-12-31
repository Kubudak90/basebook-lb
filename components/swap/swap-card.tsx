"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TokenSelect } from "./token-select"
import { ArrowDown, Settings } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { LBRouterABI, ERC20ABI, LBQuoterABI } from "@/lib/contracts/abis"
import { useTokenBalance } from "@/lib/hooks/use-token-balance"
import { useTokenAllowance } from "@/lib/hooks/use-token-allowance"
import { parseUnits, formatUnits } from "viem"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { baseSepolia } from "wagmi/chains"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

export function SwapCard() {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const [fromToken, setFromToken] = useState<Token | null>(TOKENS.WETH)
  const [toToken, setToToken] = useState<Token | null>(TOKENS.USDC)
  const [fromAmount, setFromAmount] = useState("")
  const [slippage, setSlippage] = useState("0.5")
  const [isQuoting, setIsQuoting] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const { formattedBalance: fromBalance } = useTokenBalance(fromToken?.address as `0x${string}`)
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    fromToken?.address as `0x${string}`,
    CONTRACTS.LBRouter as `0x${string}`,
  )

  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isApproving } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  const { isLoading: isSwapping } = useWaitForTransactionReceipt({
    hash: swapTxHash,
  })

  // Prepare quote parameters
  const quoteParams = useMemo(() => {
    if (!fromToken || !toToken || !fromAmount || Number(fromAmount) <= 0) {
      return null
    }

    try {
      const amountIn = parseUnits(fromAmount, fromToken.decimals)
      const route = [fromToken.address, toToken.address]
      return { amountIn, route }
    } catch {
      return null
    }
  }, [fromToken, toToken, fromAmount])

  // Get swap quote from LBQuoter
  const { data: quoteData, isLoading: isLoadingQuote } = useReadContract({
    address: CONTRACTS.LBQuoter as `0x${string}`,
    abi: LBQuoterABI,
    functionName: "findBestPathFromAmountIn",
    args: quoteParams ? [quoteParams.route as `0x${string}`[], quoteParams.amountIn] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!quoteParams,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  // Calculate output amount from quote
  const calculatedOutput = useMemo(() => {
    if (!quoteData || !toToken) return null

    try {
      // Quote returns: (route, pairs, binSteps, amounts, virtualAmountsWithoutSlippage, fees)
      const amounts = (quoteData as any).amounts
      if (!amounts || amounts.length === 0) return null

      // Last amount in the array is the output amount
      const outputAmount = amounts[amounts.length - 1]
      return formatUnits(outputAmount, toToken.decimals)
    } catch {
      return null
    }
  }, [quoteData, toToken])

  // Calculate price impact
  const priceImpact = useMemo(() => {
    if (!quoteData || !toToken) return null

    try {
      const amounts = (quoteData as any).amounts
      const virtualAmounts = (quoteData as any).virtualAmountsWithoutSlippage

      if (!amounts || !virtualAmounts || amounts.length === 0 || virtualAmounts.length === 0) {
        return null
      }

      // Get the last amounts (output amounts)
      const actualAmount = amounts[amounts.length - 1]
      const virtualAmount = virtualAmounts[virtualAmounts.length - 1]

      if (!actualAmount || !virtualAmount || virtualAmount === BigInt(0)) {
        return null
      }

      // Calculate price impact: (1 - actualAmount / virtualAmount) × 100
      const actualNum = Number(formatUnits(actualAmount, toToken.decimals))
      const virtualNum = Number(formatUnits(virtualAmount, toToken.decimals))

      const impact = ((virtualNum - actualNum) / virtualNum) * 100
      return impact
    } catch {
      return null
    }
  }, [quoteData, toToken])

  // Get price impact color and severity
  const getPriceImpactColor = (impact: number | null) => {
    if (impact === null) return { color: "text-muted-foreground", bg: "bg-muted" }
    if (impact < 1) return { color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" }
    if (impact < 3) return { color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" }
    if (impact < 5) return { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950" }
    return { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" }
  }

  const getPriceImpactWarning = (impact: number | null) => {
    if (impact === null) return null
    if (impact >= 5) return "High price impact! Your trade will significantly move the market price."
    if (impact >= 3) return "Moderate price impact. Consider splitting into smaller trades."
    if (impact >= 1) return "Low price impact."
    return null
  }

  // Validate input amount
  const validateAmount = (amount: string): string | null => {
    if (!amount || amount.trim() === "") {
      return null // Empty is ok, just disable button
    }

    const num = Number.parseFloat(amount)

    if (isNaN(num)) {
      return "Please enter a valid number"
    }

    if (num <= 0) {
      return "Amount must be greater than 0"
    }

    if (num < 0) {
      return "Amount cannot be negative"
    }

    // Check against balance
    if (fromToken && fromBalance) {
      const balance = Number.parseFloat(fromBalance)
      if (num > balance) {
        return `Insufficient balance. You have ${fromBalance} ${fromToken.symbol}`
      }
    }

    return null
  }

  // Validate slippage
  const validateSlippage = (slip: string): string | null => {
    const num = Number.parseFloat(slip)

    if (isNaN(num)) {
      return "Invalid slippage"
    }

    if (num < 0.01) {
      return "Slippage too low (min 0.01%)"
    }

    if (num > 50) {
      return "Slippage too high (max 50%)"
    }

    return null
  }

  const handleAmountChange = (value: string) => {
    setFromAmount(value)
    const error = validateAmount(value)
    setInputError(error)
  }

  const handleSlippageChange = (value: string) => {
    setSlippage(value)
    const error = validateSlippage(value)
    if (error) {
      toast({
        title: "Invalid slippage",
        description: error,
        variant: "destructive",
      })
    }
  }

  const handleSwap = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    // Clear from amount when swapping to trigger new quote
    setFromAmount("")
    setInputError(null)
  }

  const needsApproval = () => {
    if (!fromAmount || !fromToken) return false
    try {
      const amount = parseUnits(fromAmount, fromToken.decimals)
      return (allowance as bigint) < amount
    } catch {
      return false
    }
  }

  const handleApprove = async () => {
    if (!fromToken || !fromAmount) return

    try {
      const amount = parseUnits(fromAmount, fromToken.decimals)
      const hash = await writeContractAsync({
        address: fromToken.address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.LBRouter, amount],
      })

      setApproveTxHash(hash)
      toast({
        title: "Approval submitted",
        description: "Waiting for confirmation...",
      })

      await refetchAllowance()
    } catch (error: any) {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleSwapTokens = async () => {
    if (!fromToken || !toToken || !fromAmount || !address || !calculatedOutput || !quoteData) return

    try {
      const amountIn = parseUnits(fromAmount, fromToken.decimals)
      const expectedOut = parseUnits(calculatedOutput, toToken.decimals)

      // Apply slippage protection
      const minAmountOut = (expectedOut * BigInt(Math.floor((100 - Number.parseFloat(slippage)) * 100))) / BigInt(10000)

      // Get bin steps from quote
      const binSteps = (quoteData as any).binSteps || [25]

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          minAmountOut,
          binSteps,
          [fromToken.address as `0x${string}`, toToken.address as `0x${string}`],
          address,
          BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min deadline
        ],
      })

      setSwapTxHash(hash)
      toast({
        title: "Swap submitted",
        description: "Waiting for confirmation...",
      })

      setFromAmount("")
    } catch (error: any) {
      toast({
        title: "Swap failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Swap</span>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="text-muted-foreground">Balance: {fromBalance}</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={`flex-1 ${inputError ? "border-red-500" : ""}`}
              min="0"
              step="any"
            />
            <TokenSelect selectedToken={fromToken} onSelectToken={setFromToken} excludeToken={toToken} />
          </div>
          {inputError && (
            <p className="text-xs text-red-500">{inputError}</p>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" onClick={handleSwap} className="rounded-full">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="text-muted-foreground">
              {isLoadingQuote ? "Calculating..." : "Estimated"}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="0.0"
                value={calculatedOutput || ""}
                disabled
                className="flex-1 pr-8"
              />
              {isLoadingQuote && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Spinner className="h-4 w-4" />
                </div>
              )}
            </div>
            <TokenSelect selectedToken={toToken} onSelectToken={setToToken} excludeToken={fromToken} />
          </div>
        </div>

        {/* Swap Details */}
        {fromAmount && calculatedOutput && (
          <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span>
                1 {fromToken?.symbol} ≈{" "}
                {(Number.parseFloat(calculatedOutput) / Number.parseFloat(fromAmount)).toFixed(6)}{" "}
                {toToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            {priceImpact !== null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={`font-semibold ${getPriceImpactColor(priceImpact).color}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Received</span>
              <span>
                {(Number.parseFloat(calculatedOutput) * (1 - Number.parseFloat(slippage) / 100)).toFixed(6)}{" "}
                {toToken?.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Price Impact Warning */}
        {priceImpact !== null && priceImpact >= 1 && (
          <div className={`p-3 rounded-lg text-sm ${getPriceImpactColor(priceImpact).bg}`}>
            <div className="flex items-start gap-2">
              <span className={`font-semibold ${getPriceImpactColor(priceImpact).color}`}>
                ⚠️
              </span>
              <p className={getPriceImpactColor(priceImpact).color}>
                {getPriceImpactWarning(priceImpact)}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full" disabled>
            Connect Wallet
          </Button>
        ) : needsApproval() ? (
          <Button className="w-full" onClick={handleApprove} disabled={isApproving}>
            {isApproving ? (
              <>
                <Spinner className="mr-2" />
                Approving...
              </>
            ) : (
              `Approve ${fromToken?.symbol}`
            )}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleSwapTokens}
            disabled={!fromAmount || !calculatedOutput || isSwapping || isLoadingQuote || !!inputError}
          >
            {isSwapping ? (
              <>
                <Spinner className="mr-2" />
                Swapping...
              </>
            ) : isLoadingQuote ? (
              <>
                <Spinner className="mr-2" />
                Getting Quote...
              </>
            ) : inputError ? (
              "Invalid Input"
            ) : (
              "Swap"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

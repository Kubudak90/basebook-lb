"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { LBRouterABI } from "@/lib/contracts/abis"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useUserLiquidity } from "@/hooks/use-user-liquidity"
import { formatUnits } from "viem"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

export function RemoveLiquidity() {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  // TODO: Make pool selectable - for now using WETH/USDC pool
  // In production, add a dropdown to select from user's pools
  const WETH_USDC_POOL = "0x89285eAfFd4a177C68D96e9135A9353A7D3175Cb" as `0x${string}`

  const [tokenX] = useState<Token | null>(TOKENS.WETH)
  const [tokenY] = useState<Token | null>(TOKENS.USDC)
  const [binRange, setBinRange] = useState([0, 0])
  const [percentage, setPercentage] = useState([100])

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isProcessing } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Fetch real user liquidity positions
  const { positions, activeId, isLoading } = useUserLiquidity(WETH_USDC_POOL)

  // Auto-select all bins when positions load
  useMemo(() => {
    if (positions.length > 0 && binRange[0] === 0 && binRange[1] === 0) {
      setBinRange([0, positions.length - 1])
    }
  }, [positions, binRange])

  // Calculate selected bins and values
  const selectedData = useMemo(() => {
    const selectedBins = positions.filter(
      (_, i) => i >= binRange[0] && i <= binRange[1]
    )

    const totalBalance = selectedBins.reduce((sum, b) => sum + b.balance, BigInt(0))
    const adjustedBalance = (totalBalance * BigInt(percentage[0])) / BigInt(100)

    // Estimate amounts (simplified - actual calculation would need total supply)
    // For now, showing the balance which represents shares
    const totalX = selectedBins
      .filter(b => b.binId >= (activeId || 0))
      .reduce((sum, b) => sum + b.balance, BigInt(0))

    const totalY = selectedBins
      .filter(b => b.binId < (activeId || 0))
      .reduce((sum, b) => sum + b.balance, BigInt(0))

    return {
      bins: selectedBins,
      count: selectedBins.length,
      totalBalance: adjustedBalance,
      totalX: (totalX * BigInt(percentage[0])) / BigInt(100),
      totalY: (totalY * BigInt(percentage[0])) / BigInt(100),
    }
  }, [positions, binRange, percentage, activeId])

  const handleRemoveLiquidity = async () => {
    if (!tokenX || !tokenY || !address || selectedData.count === 0) return

    try {
      const selectedBins = positions.filter(
        (_, i) => i >= binRange[0] && i <= binRange[1]
      )

      // Extract bin IDs and calculate amounts
      const ids = selectedBins.map(b => BigInt(b.binId))
      const amounts = selectedBins.map(b => (b.balance * BigInt(percentage[0])) / BigInt(100))

      console.log("🗑️ Removing liquidity:")
      console.log("  Bin IDs:", ids.map(id => id.toString()))
      console.log("  Amounts:", amounts.map(amt => amt.toString()))
      console.log("  Percentage:", percentage[0] + "%")

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "removeLiquidity",
        args: [
          tokenX.address as `0x${string}`,
          tokenY.address as `0x${string}`,
          25, // binStep
          BigInt(0), // amountXMin - TODO: Add slippage protection
          BigInt(0), // amountYMin - TODO: Add slippage protection
          ids,
          amounts,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min deadline
        ],
      })

      setTxHash(hash)
      toast({ title: "Liquidity removal submitted", description: "Waiting for confirmation..." })
    } catch (error: any) {
      console.error("Remove liquidity error:", error)
      toast({ title: "Remove liquidity failed", description: error.message, variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="mr-2" />
        <span>Loading your liquidity positions...</span>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-2">No liquidity positions found</p>
        <p className="text-sm text-muted-foreground">
          You don't have any liquidity in the WETH/USDC pool yet.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* LEFT: Chart for bin selection */}
      <div className="lg:col-span-3 space-y-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Select Bins to Remove</CardTitle>
              <Badge variant="secondary">{selectedData.count} bins selected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual Bin Chart */}
            <div className="h-[220px] flex items-end justify-center gap-0.5 mb-4 px-2 overflow-x-auto">
              {positions.map((bin, i) => {
                const isSelected = i >= binRange[0] && i <= binRange[1]
                const balanceNormalized = Number(formatUnits(bin.balance, 18))
                const height = Math.min(balanceNormalized * 50 + 10, 100)
                const isActiveId = bin.binId === activeId

                return (
                  <div
                    key={bin.binId}
                    className={cn(
                      "min-w-[8px] rounded-t transition-all cursor-pointer hover:opacity-100",
                      isSelected
                        ? bin.binId >= (activeId || 0) ? "bg-blue-500" : "bg-green-500"
                        : "bg-muted-foreground/20",
                      isActiveId && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{
                      height: `${height}%`,
                      opacity: isSelected ? 1 : 0.4
                    }}
                    title={`Bin ${bin.binId}: ${formatUnits(bin.balance, 18)} shares`}
                  />
                )
              })}
            </div>

            {/* Range Slider */}
            <div className="space-y-3">
              <Slider
                value={binRange}
                onValueChange={setBinRange}
                min={0}
                max={Math.max(0, positions.length - 1)}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Bin {positions[binRange[0]]?.binId || 0}</span>
                <span className="text-primary font-medium">Drag to select range</span>
                <span>Bin {positions[binRange[1]]?.binId || 0}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                <span className="text-muted-foreground">Not Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-muted-foreground">{tokenY?.symbol} bins</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-muted-foreground">{tokenX?.symbol} bins</span>
              </div>
              {activeId && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary ring-2 ring-primary ring-offset-1" />
                  <span className="text-muted-foreground">Active Bin</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Select Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBinRange([0, positions.length - 1])}
            className="flex-1"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const activeIndex = positions.findIndex(p => p.binId === activeId)
              if (activeIndex > 0) setBinRange([0, activeIndex - 1])
            }}
            className="flex-1"
          >
            Below Active
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const activeIndex = positions.findIndex(p => p.binId === activeId)
              if (activeIndex >= 0 && activeIndex < positions.length - 1) {
                setBinRange([activeIndex + 1, positions.length - 1])
              }
            }}
            className="flex-1"
          >
            Above Active
          </Button>
        </div>
      </div>

      {/* RIGHT: Summary and Actions */}
      <div className="lg:col-span-2 space-y-4">
        {/* Token Pair Info */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex -space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                {tokenX?.symbol.slice(0, 2)}
              </div>
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                {tokenY?.symbol.slice(0, 2)}
              </div>
            </div>
            <div>
              <p className="font-medium">{tokenX?.symbol} - {tokenY?.symbol}</p>
              <p className="text-xs text-muted-foreground">
                {positions.length} bins with liquidity
              </p>
            </div>
          </div>
        </Card>

        {/* Percentage Slider */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Removal Percentage</Label>
              <span className="text-lg font-bold">{percentage[0]}%</span>
            </div>
            <Slider
              value={percentage}
              onValueChange={setPercentage}
              min={1}
              max={100}
              step={1}
            />
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <Button
                  key={pct}
                  variant={percentage[0] === pct ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPercentage([pct])}
                  className="flex-1"
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <h4 className="text-sm font-medium mb-3">You Will Remove</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenX?.symbol.slice(0, 1)}
                </div>
                {tokenX?.symbol} Bins
              </span>
              <span className="font-mono font-bold">
                {formatUnits(selectedData.totalX, tokenX?.decimals || 18).slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenY?.symbol.slice(0, 1)}
                </div>
                {tokenY?.symbol} Bins
              </span>
              <span className="font-mono font-bold">
                {formatUnits(selectedData.totalY, tokenY?.decimals || 18).slice(0, 8)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Shares</span>
              <span className="font-bold">
                {formatUnits(selectedData.totalBalance, 18).slice(0, 10)}
              </span>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
            Connect Wallet
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            onClick={handleRemoveLiquidity}
            disabled={isProcessing || selectedData.count === 0}
          >
            {isProcessing ? (
              <>
                <Spinner className="mr-2" />
                Removing...
              </>
            ) : (
              `Remove from ${selectedData.count} Bins`
            )}
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Liquidity will be removed from selected bins based on the percentage.
        </p>
      </div>
    </div>
  )
}

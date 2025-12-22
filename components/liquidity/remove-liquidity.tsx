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

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

// Mock user positions data
const MOCK_POSITIONS = Array.from({ length: 40 }).map((_, i) => ({
  binId: 8388608 + i - 20,
  index: i,
  price: 0.0008 + i * 0.00001,
  amountX: i > 20 ? Math.random() * 0.5 + 0.1 : 0,
  amountY: i <= 20 ? Math.random() * 500 + 100 : 0,
  valueUSD: Math.random() * 100 + 50,
  isSelected: false
}))

export function RemoveLiquidity() {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const [tokenX] = useState<Token | null>(TOKENS.WETH)
  const [tokenY] = useState<Token | null>(TOKENS.USDC)
  const [binRange, setBinRange] = useState([15, 25])
  const [percentage, setPercentage] = useState([100])

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isProcessing } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Calculate selected bins and values
  const selectedData = useMemo(() => {
    const selectedBins = MOCK_POSITIONS.filter(
      (_, i) => i >= binRange[0] && i <= binRange[1]
    )
    const totalX = selectedBins.reduce((sum, b) => sum + b.amountX, 0)
    const totalY = selectedBins.reduce((sum, b) => sum + b.amountY, 0)
    const totalValue = selectedBins.reduce((sum, b) => sum + b.valueUSD, 0)

    return {
      bins: selectedBins,
      count: selectedBins.length,
      totalX: totalX * (percentage[0] / 100),
      totalY: totalY * (percentage[0] / 100),
      totalValue: totalValue * (percentage[0] / 100)
    }
  }, [binRange, percentage])

  const handleRemoveLiquidity = async () => {
    if (!tokenX || !tokenY || !address) return

    try {
      const selectedBins = MOCK_POSITIONS.filter(
        (_, i) => i >= binRange[0] && i <= binRange[1]
      )
      const ids = selectedBins.map(b => BigInt(b.binId))
      const amounts = selectedBins.map(() => BigInt(percentage[0]))

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "removeLiquidity",
        args: [
          tokenX.address as `0x${string}`,
          tokenY.address as `0x${string}`,
          25, // binStep
          BigInt(0),
          BigInt(0),
          ids,
          amounts,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 1200),
        ],
      })

      setTxHash(hash)
      toast({ title: "Liquidity removal submitted", description: "Waiting for confirmation..." })
    } catch (error: any) {
      toast({ title: "Remove liquidity failed", description: error.message, variant: "destructive" })
    }
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
            <div className="h-[220px] flex items-end justify-center gap-0.5 mb-4 px-2">
              {MOCK_POSITIONS.map((bin, i) => {
                const isSelected = i >= binRange[0] && i <= binRange[1]
                const height = (bin.amountX + bin.amountY / 1000) * 100 + 20
                const isCurrentPrice = i === 20

                return (
                  <div
                    key={i}
                    className={cn(
                      "w-2 rounded-t transition-all cursor-pointer hover:opacity-100",
                      isSelected
                        ? bin.amountX > 0 ? "bg-red-500" : "bg-green-500"
                        : "bg-muted-foreground/20",
                      isCurrentPrice && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{
                      height: `${Math.min(height, 100)}%`,
                      opacity: isSelected ? 1 : 0.4
                    }}
                    title={`Bin ${bin.binId}: $${bin.valueUSD.toFixed(2)}`}
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
                max={39}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Bin {MOCK_POSITIONS[binRange[0]]?.binId}</span>
                <span className="text-primary font-medium">Drag to select range</span>
                <span>Bin {MOCK_POSITIONS[binRange[1]]?.binId}</span>
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
                <span className="text-muted-foreground">{tokenY?.symbol} to Remove</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-muted-foreground">{tokenX?.symbol} to Remove</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Select Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBinRange([0, 39])} className="flex-1">
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBinRange([0, 19])} className="flex-1">
            Below Current
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBinRange([21, 39])} className="flex-1">
            Above Current
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBinRange([15, 25])} className="flex-1">
            Around Current
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
              <p className="text-xs text-muted-foreground">Your Liquidity Position</p>
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
          <h4 className="text-sm font-medium mb-3">You Will Receive</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenX?.symbol.slice(0, 1)}
                </div>
                {tokenX?.symbol}
              </span>
              <span className="font-mono font-bold">{selectedData.totalX.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenY?.symbol.slice(0, 1)}
                </div>
                {tokenY?.symbol}
              </span>
              <span className="font-mono font-bold">{selectedData.totalY.toFixed(2)}</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Value</span>
              <span className="font-bold text-lg">${selectedData.totalValue.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
            Cüzdan Bağla
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
              `Remove ${selectedData.count} Bins`
            )}
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Seçilen binlerden likidite çıkarılacaktır.
        </p>
      </div>
    </div>
  )
}

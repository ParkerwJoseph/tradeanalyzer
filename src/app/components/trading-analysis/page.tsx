'use client'

import { useState } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Trade {
  date: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  profitLoss?: number;
}

interface RiskMetrics {
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestLoss: number;
  riskToleranceScore: number;
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
}

const TradingAnalyzer = () => {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeTrades = (trades: Trade[]): RiskMetrics => {
    const winningTrades = trades.filter(trade => (trade.profitLoss || 0) > 0);
    const losingTrades = trades.filter(trade => (trade.profitLoss || 0) < 0);
    
    const winRate = (winningTrades.length / trades.length) * 100;
    const averageWin = winningTrades.reduce((acc, trade) => acc + (trade.profitLoss || 0), 0) / winningTrades.length;
    const averageLoss = Math.abs(losingTrades.reduce((acc, trade) => acc + (trade.profitLoss || 0), 0) / losingTrades.length);
    const largestLoss = Math.abs(Math.min(...trades.map(t => t.profitLoss || 0)));
    
    // Calculate risk tolerance score (0-100)
    const riskToleranceScore = calculateRiskScore(winRate, averageWin, averageLoss, largestLoss);
    
    return {
      winRate,
      averageWin,
      averageLoss,
      largestLoss,
      riskToleranceScore,
      riskLevel: getRiskLevel(riskToleranceScore)
    };
  };

  const calculateRiskScore = (
    winRate: number,
    averageWin: number,
    averageLoss: number,
    largestLoss: number
  ): number => {
    // Risk score calculation factors
    const winRateWeight = 0.3;
    const riskRewardWeight = 0.3;
    const maxLossWeight = 0.4;

    const riskRewardRatio = averageWin / averageLoss;
    const normalizedMaxLoss = Math.min(largestLoss / 10000, 1); // Normalize largest loss

    const score = (
      (winRate * winRateWeight) +
      (riskRewardRatio * 20 * riskRewardWeight) +
      ((1 - normalizedMaxLoss) * 100 * maxLossWeight)
    );

    return Math.min(Math.max(score, 0), 100);
  };

  const getRiskLevel = (score: number): RiskMetrics['riskLevel'] => {
    if (score < 40) return 'Conservative';
    if (score < 70) return 'Moderate';
    return 'Aggressive';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const trades = parseCSV(text);
      const riskMetrics = analyzeTrades(trades);
      setMetrics(riskMetrics);
      setError(null);
    } catch (err) {
      setError('Error processing file. Please ensure it\'s a valid CSV format.');
      setMetrics(null);
    }
  };

  const parseCSV = (csv: string): Trade[] => {
    const lines = csv.split('\n');
    const headers = lines[0].toLowerCase().split(',');
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',');
        return {
          date: values[headers.indexOf('trade date')],
          symbol: values[headers.indexOf('name')],
          type: values[headers.indexOf('type')].toLowerCase() as 'buy' | 'sell',
          price: parseFloat(values[headers.indexOf('price')]),
          quantity: parseFloat(values[headers.indexOf('qty')]),
          profitLoss: parseFloat(values[headers.indexOf('gain/loss')])
        };
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading History Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-center">
            <Button variant="outline" className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="mr-2 h-4 w-4" />
              Upload Trading History
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {metrics && (
            <div className="grid gap-4">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">Risk Tolerance Score</h3>
                <div className="text-4xl font-bold text-primary">
                  {metrics.riskToleranceScore.toFixed(1)}
                </div>
                <div className="text-lg text-muted-foreground mt-1">
                  {metrics.riskLevel} Trader
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                  <div className="text-lg font-semibold">{metrics.winRate.toFixed(1)}%</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">Risk/Reward</div>
                  <div className="text-lg font-semibold">
                    {(metrics.averageWin / metrics.averageLoss).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingAnalyzer; 
'use client'

import { useState } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { database } from '@/lib/firebase'
import { ref, update } from 'firebase/database'
import OpenAI from 'openai'

interface RiskMetrics {
  riskToleranceScore: number
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive'
  holdingPeriodAnalysis?: string
  instrumentAnalysis?: string
  leveragedExposure?: string
  dividendExposure?: string
}

const SYSTEM_PROMPT = "You are a professional trading analyst. "

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

// Initialize OpenAI client only if API key exists
const openai = typeof window !== 'undefined' && apiKey ? new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true
}) : null;

const queryAI = async (prompt: string): Promise<string> => {
  if (!openai) {
    throw new Error('client is not initialized.');
  }
  
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: `You are a professional trading analyst. 
        Analyze trading patterns using these specific criteria:

        1. Aggressive Trading Indicators (Score 8-10):
           * Heavy usage of 3x leveraged ETFs (>20% of trades):
             - Bull ETFs: TQQQ, UPRO, SPXL, UDOW
             - Bear ETFs: SQQQ, SPXS, SDOW
           * Day trading leveraged ETFs
           * Switching between bull/bear leveraged ETFs
           * Position holding < 1 week
           * Large position sizes (>10% portfolio per trade)

        2. Moderate Trading Indicators (Score 4-7):
           * Mixed portfolio with some risk:
             - Occasional leveraged ETF usage (<20% of trades)
             - Growth stocks (TSLA, NVDA, etc.)
             - Some options trading
           * Position holding 1 week to 3 months
           * Moderate position sizes (5-10% portfolio)

        3. Conservative Trading Indicators (Score 1-3):
           * Focus on stable investments:
             - Dividend stocks (JNJ, PG, KO)
             - Blue chip stocks
             - Index funds (SPY, QQQ)
             - REITs, Utilities
           * Position holding > 3 months
           * Smaller position sizes (<5% portfolio)
           * No leveraged products

        Calculate Risk Score:
        - Start at 5 (neutral)
        - Add 1-3 points for each aggressive indicator
        - Subtract 1-3 points for each conservative indicator
        
        IMPORTANT: Respond with ONLY this JSON format:
        {
          "riskScore": number between 1-10,
          "riskLevel": "Conservative" or "Moderate" or "Aggressive",
          "leveragedExposure": "Detailed % of portfolio in leveraged ETFs, specific ETFs used, trading frequency",
          "dividendExposure": "% of portfolio in dividend stocks, specific stocks, holding periods",
          "holdingPeriodAnalysis": "Average holding periods for different types of instruments",
          "instrumentAnalysis": "Breakdown of portfolio by instrument type (%)",
          "explanation": "Detailed explanation of risk assessment and trading style"
        }` 
      },
      { role: "user", content: prompt }
    ],
    model: "gpt-4",
    temperature: 0.3,
  })
  return completion.choices[0].message.content || ''
}

export default function TradingAnalyzer({ userId, onAnalysisComplete }: { 
  userId: string, 
  onAnalysisComplete: (metrics: RiskMetrics) => void 
}) {
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const text = await file.text()
      const trades = text.split('\n').slice(0, 100).join('\n')
      
      const prompt = `Analyze this trading history and determine the trader's risk profile.
        
        Key Analysis Requirements:
        1. Portfolio Composition Analysis:
           - Calculate exact percentage of:
             * Leveraged ETF exposure (especially 3x ETFs)
             * Dividend stock holdings
             * Growth stocks
             * Blue chip stocks
             * Other instruments
        
        2. Trading Behavior Analysis:
           - Calculate average holding periods for:
             * Leveraged ETFs
             * Regular stocks
             * Dividend stocks
           - Identify day trading patterns
           - Calculate position sizes relative to portfolio
        
        3. Risk Pattern Analysis:
           - Identify if trader switches between bull/bear ETFs
           - Calculate frequency of leveraged ETF trades
           - Analyze position sizing patterns
           - Look for dividend stock holding patterns

        Trading data:\n${trades}

        Provide a precise analysis in JSON format focusing on actual percentages and specific patterns identified.`

      const response = await queryAI(prompt)
      let analysis
      try {
        const cleanResponse = response
          .replace(/```json\n?|\n?```/g, '')
          .replace(/^[\s\n]*|\s*$/g, '')
          .replace(/[\u201C\u201D]/g, '"')
          .trim()
        
        if (!cleanResponse.startsWith('{') || !cleanResponse.endsWith('}')) {
          throw new Error('Response is not a valid JSON object')
        }

        analysis = JSON.parse(cleanResponse)
        
        const requiredFields = ['riskScore', 'riskLevel', 'holdingPeriodAnalysis', 'instrumentAnalysis', 'leveragedExposure', 'dividendExposure', 'explanation']
        for (const field of requiredFields) {
          if (!(field in analysis)) {
            throw new Error(`Missing required field: ${field}`)
          }
        }
      } catch (error) {
        console.error('Failed to parse AI response:', error)
        console.error('Raw response:', response)
        throw new Error('Invalid response format from AI')
      }

      const metrics = {
        riskToleranceScore: analysis.riskScore,
        riskLevel: analysis.riskLevel as RiskMetrics['riskLevel'],
        holdingPeriodAnalysis: analysis.holdingPeriodAnalysis,
        instrumentAnalysis: analysis.instrumentAnalysis,
        leveragedExposure: analysis.leveragedExposure,
        dividendExposure: analysis.dividendExposure
      }

      const userRef = ref(database, `users/${userId}`)
      await update(userRef, {
        riskAnalysis: metrics,
        lastAnalysisDate: new Date().toISOString()
      })

      onAnalysisComplete(metrics)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Error processing file.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Button variant="outline" className="relative" disabled={isAnalyzing}>
          <input
            type="file"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isAnalyzing}
          />
          <Upload className="mr-2 h-4 w-4" />
          {isAnalyzing ? 'Analyzing...' : 'Upload Trading History'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
} 
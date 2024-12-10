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
}

const SYSTEM_PROMPT = "You are a professional trading analyst. "

const openai = new OpenAI({
  apiKey: "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",
  dangerouslyAllowBrowser: true
})

const queryAI = async (prompt: string): Promise<string> => {
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    model: "gpt-4o",
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
      
      const prompt = `Analyze this trading data and provide a risk assessment. Return a JSON object with fields: riskScore (number 1-10), riskLevel (string: "Conservative", "Moderate", or "Aggressive"), and explanation (string). Data:\n${trades}`

      const response = await queryAI(prompt)
      let analysis
      try {
        const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
        analysis = JSON.parse(cleanResponse)
      } catch (error) {
        console.error('Failed to parse AI response:', error, response)
        throw new Error('Invalid response format from AI')
      }

      const metrics = {
        riskToleranceScore: analysis.riskScore,
        riskLevel: analysis.riskLevel as RiskMetrics['riskLevel']
      }

      // Update database with risk analysis
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
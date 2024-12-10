'use client'

import { useState, useEffect } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import OpenAI from 'openai';

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



const SYSTEM_PROMPT = "You are a professional trading analyst. ";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const queryAI = async (prompt: string): Promise<string> => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o",
      temperature: 0.7,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
};

const TradingAnalyzer = () => {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      console.log('Processing file of size:', text.length);
      
      // Ensure we have valid data before processing
      if (!text.trim()) {
        throw new Error('File appears to be empty');
      }

      const trades = text.split('\n').slice(0, 100).join('\n');
      console.log('Processed trades length:', trades.length);
      
      const prompt = `Analyze this trading data and provide a risk assessment. Return a JSON object with fields: riskScore (number 1-10), riskLevel (string: "Conservative", "Moderate", or "Aggressive"), and explanation (string). Data:\n${trades}`;

      const response = await queryAI(prompt);
      console.log('API Response:', response);

      let analysis;
      try {
        // Try to parse the entire response first
        analysis = JSON.parse(response);
      } catch {
        // If that fails, try to extract JSON using a more flexible regex
        const jsonMatch = response.match(/\{(?:[^{}]|{[^{}]*})*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid response format: Expected JSON data');
        }
        
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('Failed to parse response data');
        }
      }

      if (!analysis?.riskScore || !analysis?.riskLevel) {
        throw new Error('Missing required fields in response');
      }

      setMetrics({
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        largestLoss: 0,
        riskToleranceScore: analysis.riskScore,
        riskLevel: analysis.riskLevel as RiskMetrics['riskLevel']
      });
      setAiResponse(analysis.explanation);
    } catch (err) {
      console.error('Full error:', err);
      const error = err as Error;  // Type assertion
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setError(error.message || 'Error processing file.');
      setMetrics(null);
    }
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
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="mr-2 h-4 w-4" />
              Upload File
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
                <h3 className="text-2xl font-bold mb-2">AI Risk Analysis</h3>
                <div className="text-4xl font-bold text-primary">
                  {metrics.riskToleranceScore.toFixed(1)}
                </div>
                <div className="text-lg text-muted-foreground mt-1">
                  {metrics.riskLevel} Trader
                </div>
                {aiResponse && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    {aiResponse}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingAnalyzer; 
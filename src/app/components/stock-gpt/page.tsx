'use client'

import { useState, useEffect } from 'react'
import axios, { AxiosError } from 'axios'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageTemplate from '@/components/layout/PageTemplate'
import { useTypewriter } from '@/hooks/useTypewriter'

// Types
interface StockData {
    price: {
        current: number;
        previousClose: number;
        dayRange?: {
            low: number;
            high: number;
        };
        fiftyTwoWeek?: {
            low: number;
            high: number;
        };
    };
    technicalLevels: {
        fiftyDayMA: number;
        twoHundredDayMA: number;
        support: number;
        resistance: number;
    };
    changes: {
        daily: string;
        momentum: string;
        trendStrength: string;
    };
    tradingData: {
        volume: number;
        avgVolume: number;
        volumeRatio: number;
        beta?: number;
    };
    valuationMetrics: {
        marketCap: number;
        peRatio?: number;
        forwardPE?: number;
    };
    dividend?: {
        yield: string;
        rate: string | number;
    };
}

interface ConversationMessage {
    type: 'user' | 'system' | 'error' | 'data';
    content: string;
    timestamp: Date;
    data?: Partial<StockData>;
}

interface StockAnalysisResponse {
    success: boolean;
    data?: StockData;
    analysis?: string;
    message?: string;
    error?: string;
}

// Add this type for API errors
interface ApiError {
    code?: string;
    response?: {
        status?: number;
        data?: {
            message?: string;
        };
    };
    message?: string;
}

function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
}

function formatLargeNumber(number: number | undefined | null): string {
    if (!number) return 'N/A';
    if (number >= 1e12) return `${(number / 1e12).toFixed(2)}T`;
    if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
    if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
    return number.toFixed(2);
}

function safeNumber(value: number | undefined | null, decimals = 2): string {
    if (value === null || value === undefined || isNaN(value)) {
        return 'N/A';
    }
    return Number(value).toFixed(decimals);
}

// Stock Data Display Component
function StockDataDisplay({ data }: { data: StockData }) {
    return (
        <div className="grid gap-4 text-sm mt-4 border rounded-lg p-4">
            {/* Price Information */}
            <div className="border-b pb-4">
                <h3 className="font-medium mb-2">Price Information</h3>
                <div className="grid gap-2">
                    <div>Current Price: <span className="text-green-500">${safeNumber(data.price.current)}</span></div>
                    <div>Previous Close: ${safeNumber(data.price.previousClose)}</div>
                    {data.price.dayRange && (
                        <div>Day Range: ${safeNumber(data.price.dayRange.low)} - ${safeNumber(data.price.dayRange.high)}</div>
                    )}
                </div>
            </div>

            {/* Technical Analysis */}
            <div className="border-b pb-4">
                <h3 className="font-medium mb-2">Technical Analysis</h3>
                <div className="grid gap-2">
                    <div>50-Day MA: ${safeNumber(data.technicalLevels.fiftyDayMA)}</div>
                    <div>200-Day MA: ${safeNumber(data.technicalLevels.twoHundredDayMA)}</div>
                    <div>Support: <span className="text-green-500">${safeNumber(data.technicalLevels.support)}</span></div>
                    <div>Resistance: <span className="text-red-500">${safeNumber(data.technicalLevels.resistance)}</span></div>
                </div>
            </div>

            {/* Changes and Momentum */}
            <div className="border-b pb-4">
                <h3 className="font-medium mb-2">Price Changes</h3>
                <div className="grid gap-2">
                    <div>Daily Change: {data.changes.daily}</div>
                    <div>Momentum: {data.changes.momentum}</div>
                    <div>Trend Strength: {data.changes.trendStrength}</div>
                </div>
            </div>

            {/* Volume Analysis */}
            <div className="border-b pb-4">
                <h3 className="font-medium mb-2">Volume Analysis</h3>
                <div className="grid gap-2">
                    <div>Volume: {formatNumber(data.tradingData.volume)}</div>
                    <div>Avg Volume: {formatNumber(data.tradingData.avgVolume)}</div>
                    <div>Volume Ratio: {safeNumber(data.tradingData.volumeRatio)}</div>
                    <div>Beta: {safeNumber(data.tradingData.beta)}</div>
                </div>
            </div>

            {/* Valuation Metrics */}
            <div className="border-b pb-4">
                <h3 className="font-medium mb-2">Valuation Metrics</h3>
                <div className="grid gap-2">
                    <div>Market Cap: ${formatLargeNumber(data.valuationMetrics.marketCap)}</div>
                    <div>P/E Ratio: {safeNumber(data.valuationMetrics.peRatio)}</div>
                    <div>Forward P/E: {safeNumber(data.valuationMetrics.forwardPE)}</div>
                </div>
            </div>

            {/* Dividend Information */}
            {data.dividend && data.dividend.yield !== 'N/A' && (
                <div className="border-b pb-4">
                    <h3 className="font-medium mb-2">Dividend Information</h3>
                    <div className="grid gap-2">
                        <div>Yield: {data.dividend.yield}</div>
                        <div>Rate: ${data.dividend.rate}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Add new component for animated messages
function AnimatedMessage({ content }: { content: string }) {
    const { displayedText, isTyping } = useTypewriter(content);
    
    return (
        <div className="whitespace-pre-wrap">
            {displayedText}
            {isTyping && <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse"/>}
        </div>
    );
}

// Main Component
export default function StockAnalyzerPage() {
    const [messages, setMessages] = useState<ConversationMessage[]>([])
    const [input, setInput] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)

    const tickerPatterns = {
        dollarSymbol: /\$([A-Za-z]{1,5})\b/,
        standardFormat: /\b(?:of|at|is|about|analyze|for)\s+([A-Za-z]{1,5})\b/i,
        standalone: /\b([A-Za-z]{1,5})\b/,
    }

    const addMessage = (type: ConversationMessage['type'], content: string, data?: Partial<StockData>) => {
        setMessages((prev) => [
            ...prev,
            {
                type,
                content,
                timestamp: new Date(),
                data
            },
        ])
    }

    const extractTicker = (query: string): string | null => {
        for (const [_, pattern] of Object.entries(tickerPatterns)) {
            const match = query.match(pattern)
            if (match && match[1]) {
                return match[1].toUpperCase()
            }
        }
        return null
    }

    // Update the handleError function with Axios error type
    const handleError = (error: AxiosError | Error) => {
        let errorMessage = 'I apologize, but ';

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                errorMessage += 'the request timed out. Please try again.';
            } else if (error.response?.status === 429) {
                errorMessage += "I've reached my API rate limit. Please wait a moment and try again.";
            } else {
                errorMessage += 'there was an issue connecting to the server. Please try again later.';
            }
        } else {
            errorMessage += 'an unexpected error occurred. Please try again.';
        }

        addMessage('error', errorMessage);
    };

    const analyzeStock = async (query: string) => {
        try {
            const ticker = extractTicker(query)
            if (!ticker) {
                addMessage(
                    'system',
                    "I couldn't find a stock ticker in your query. Try using a format like 'Analyze AAPL' or '$AAPL'."
                )
                return
            }

            addMessage('system', `I found the ticker ${ticker} in your query. Let me analyze it for you...`)
            setIsLoading(true)

            const response = await axios.get<StockAnalysisResponse>(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${ticker}`,
                {
                    validateStatus: (status) => status < 500,
                    timeout: 30000,
                }
            )

            if (response.data.success && response.data.data) {
                // Add stock data message
                addMessage('data', 'Here are the current metrics:', response.data.data)
                
                // Add analysis message if available
                if (response.data.analysis) {
                    addMessage('system', response.data.analysis)
                }
            } else {
                throw new Error(response.data.error || 'Unknown error occurred')
            }
        } catch (error: unknown) {
            handleError(error as AxiosError | Error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        addMessage('user', input)
        await analyzeStock(input)
        setInput('')
    }

    // Add this effect to auto-scroll to bottom when new messages arrive
    useEffect(() => {
        const scrollToBottom = () => {
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        };
        scrollToBottom();
    }, [messages]);

    return (
        <PageTemplate title="Stock Analyzer" description="Get AI-powered stock analysis">
            <div className="h-[calc(100vh-var(--nav-height)-var(--header-height))] relative bg-white">
                {/* Scrollable conversation area */}
                <div 
                    id="chat-container"
                    className="absolute top-0 left-0 right-0 bottom-24 overflow-y-auto"
                >
                    <div className="max-w-3xl mx-auto p-4 space-y-6">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${
                                    message.type === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                <div
                                    className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                                        message.type === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : message.type === 'error'
                                            ? 'bg-destructive/10 text-destructive'
                                            : message.type === 'data'
                                            ? 'bg-white border border-gray-200'
                                            : 'bg-gray-100'
                                    }`}
                                >
                                    {message.type === 'user' ? (
                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                    ) : (
                                        <AnimatedMessage content={message.content} />
                                    )}
                                    {message.type === 'data' && message.data && (
                                        <div className="overflow-auto max-h-[60vh] mt-4">
                                            <StockDataDisplay data={message.data as StockData} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-center items-center py-4">
                                <div className="animate-pulse flex space-x-2">
                                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed input bar */}
                <div className="absolute bottom-0 left-0 right-0 h-24 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <div className="max-w-3xl mx-auto p-4">
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <Input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about a stock (e.g., 'Analyze AAPL' or '$TSLA')"
                                disabled={isLoading}
                                className="rounded-full border-gray-200"
                            />
                            <Button 
                                type="submit" 
                                disabled={isLoading || !input.trim()}
                                className="rounded-full"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </PageTemplate>
    )
}
'use client'

import { useState, useEffect, useMemo } from 'react'
import axios, { AxiosError } from 'axios'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageTemplate from '@/components/layout/PageTemplate'
import { useTypewriter } from '@/hooks/useTypewriter'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic'

// Types
interface StockData {
    ticker?: string;
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
    type: 'user' | 'system' | 'error' | 'data' | 'chart';
    content: string;
    timestamp: Date;
    data?: Partial<StockData>;
    ticker?: string;
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

// Add this type for the chart data
interface ChartDataPoint {
    name: string;
    value: number;
}

// Add this type above the StockChart component
type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD';

// Add new type for chart types
type ChartType = 'area' | 'bar' | 'candle' | 'candlestick';

// Add this type definition
interface TradingViewWidgetProps {
    symbol: string;
}

// Add these interfaces at the top with other types
interface ChartSection {
    id: string;
    symbol: string;
    timestamp: Date;
}

// Add this helper function at the top level
function generateChartId(symbol: string, timestamp: number): string {
    return `tradingview_${symbol}_${timestamp}`;
}

// Add this component for the enhanced TradingView chart
const EnhancedTradingViewChart = ({ symbol, containerId }: { symbol: string; containerId: string }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            // @ts-expect-error TradingView types not available
            new TradingView.widget({
                width: '100%',
                height: 600,
                symbol: symbol,
                interval: 'D',
                timezone: 'exchange',
                theme: 'light',
                style: '1',
                toolbar_bg: '#f1f3f6',
                enable_publishing: false,
                allow_symbol_change: true,
                container_id: containerId,
                studies: [
                    "MASimple@tv-basicstudies",
                    "MACD@tv-basicstudies",
                    "RSI@tv-basicstudies"
                ],
                loading_screen: { backgroundColor: "#ffffff" },
                hide_side_toolbar: false,
                show_popup_button: true,
                popup_width: '1000',
                popup_height: '650',
                // Additional features
                withdateranges: true,
                hide_volume: false,
                volume_precision: 2,
                onready: () => {
                    setIsLoading(false);
                }
            });
        };

        return () => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '';
        };
    }, [symbol, containerId]);

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-gray-600">Loading chart data...</span>
                    </div>
                </div>
            )}
            <div id={containerId} className="w-full" />
        </div>
    );
};

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

// Add this function to transform the API data
function transformChartData(apiResponse: any): ChartDataPoint[] {
    // Parse the API response and transform it into chart data
    // This is a placeholder - adjust according to actual API response structure
    return Object.entries(apiResponse.data || {}).map(([date, value]: [string, any]) => ({
        name: date,
        value: value.close || 0
    }));
}

// Stock Data Display Component
function StockDataDisplay({ data, symbol }: { data: StockData; symbol: string }) {
    const [showCandlestick, setShowCandlestick] = useState(false);
    const containerId = useMemo(() => generateChartId(symbol, Date.now()), [symbol]);
    const fullscreenId = useMemo(() => `fullscreen_${containerId}`, [containerId]);
    
    return (
        <div className="space-y-6 mt-4">
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-medium">{symbol} Price Chart</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCandlestick(true)}
                    >
                        Full Screen
                    </Button>
                </div>
                <EnhancedTradingViewChart 
                    symbol={symbol} 
                    containerId={containerId} 
                />
            </div>

            {showCandlestick && (
                <div className="fixed inset-0 bg-black z-50">
                    <div className="absolute top-4 right-4 z-50">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowCandlestick(false)}
                            className="bg-white/10 hover:bg-white/20"
                        >
                            <X className="h-4 w-4 text-white" />
                        </Button>
                    </div>
                    <EnhancedTradingViewChart 
                        symbol={symbol} 
                        containerId={fullscreenId} 
                    />
                </div>
            )}

            {/* Horizontally Scrollable Metrics Section */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {/* Price Information */}
                    <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                        <h3 className="font-medium mb-3 text-gray-900">Price Information</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Current:</span>
                                <span className="font-medium text-green-600">${safeNumber(data.price.current)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Previous Close:</span>
                                <span className="font-medium">${safeNumber(data.price.previousClose)}</span>
                            </div>
                            {data.price.dayRange && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Day Range:</span>
                                    <span className="font-medium">${safeNumber(data.price.dayRange.low)} - ${safeNumber(data.price.dayRange.high)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Technical Levels */}
                    <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                        <h3 className="font-medium mb-3 text-gray-900">Technical Levels</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">50-Day MA:</span>
                                <span className="font-medium">${safeNumber(data.technicalLevels.fiftyDayMA)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">200-Day MA:</span>
                                <span className="font-medium">${safeNumber(data.technicalLevels.twoHundredDayMA)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Support:</span>
                                <span className="font-medium text-green-600">${safeNumber(data.technicalLevels.support)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Resistance:</span>
                                <span className="font-medium text-red-600">${safeNumber(data.technicalLevels.resistance)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Changes */}
                    <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                        <h3 className="font-medium mb-3 text-gray-900">Price Changes</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Daily Change:</span>
                                <span className="font-medium">{data.changes.daily}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Momentum:</span>
                                <span className="font-medium">{data.changes.momentum}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Trend Strength:</span>
                                <span className="font-medium">{data.changes.trendStrength}</span>
                            </div>
                        </div>
                    </div>

                    {/* Volume */}
                    <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                        <h3 className="font-medium mb-3 text-gray-900">Volume Analysis</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Volume:</span>
                                <span className="font-medium">{formatNumber(data.tradingData.volume)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Avg Volume:</span>
                                <span className="font-medium">{formatNumber(data.tradingData.avgVolume)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Volume Ratio:</span>
                                <span className="font-medium">{safeNumber(data.tradingData.volumeRatio)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Valuation */}
                    <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                        <h3 className="font-medium mb-3 text-gray-900">Valuation</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Market Cap:</span>
                                <span className="font-medium">${formatLargeNumber(data.valuationMetrics.marketCap)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">P/E Ratio:</span>
                                <span className="font-medium">{safeNumber(data.valuationMetrics.peRatio)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Forward P/E:</span>
                                <span className="font-medium">{safeNumber(data.valuationMetrics.forwardPE)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Dividend Information */}
                    {data.dividend && data.dividend.yield !== 'N/A' && (
                        <div className="bg-white border rounded-xl p-4 shadow-sm min-w-[280px]">
                            <h3 className="font-medium mb-3 text-gray-900">Dividend</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Yield:</span>
                                    <span className="font-medium">{data.dividend.yield}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Rate:</span>
                                    <span className="font-medium">${data.dividend.rate}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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

// Add these interfaces at the top with your other types
interface ErrorResponse {
    message: string;
    status: number;
}

interface ApiResponse {
    data: StockData;
    error?: ErrorResponse;
}

// First, define an interface for the error response
interface ApiErrorResponse {
    response?: {
        data?: {
            message?: string;
        };
        status?: number;
    };
    message: string;
}

// Main Component
export default function StockAnalyzerPage() {
    const [messages, setMessages] = useState<ConversationMessage[]>([])
    const [input, setInput] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [currentTicker, setCurrentTicker] = useState<string>('')
    const [tickerSymbols, setTickerSymbols] = useState<string[]>([])
    const [showCandlestick, setShowCandlestick] = useState(false)
    const [error, setError] = useState<string>('')

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
    const handleError = (error: ApiErrorResponse) => {
        if ('response' in error && error.response?.data) {
            setError(error.response.data.message || 'An error occurred while fetching data');
        } else {
            setError(error.message || 'An unexpected error occurred');
        }
        setIsLoading(false);
    };

    const analyzeStock = async (ticker: string) => {
        try {
            setIsLoading(true);
            const upperTicker = ticker.toUpperCase();
            setCurrentTicker(upperTicker);
            
            if (!tickerSymbols.includes(upperTicker)) {
                setTickerSymbols(prev => [...prev, upperTicker]);
            }

            const response = await axios.get<StockAnalysisResponse>(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${upperTicker}`,
                {
                    validateStatus: (status) => status < 500,
                    timeout: 30000,
                }
            )

            if (response.data.success && response.data.data) {
                addMessage('system', `Loading ${upperTicker} stock data...`)
                addMessage('data', `Here are the current metrics for ${upperTicker}:`, {
                    ...response.data.data,
                    ticker: upperTicker
                })
                
                if (response.data.analysis) {
                    addMessage('system', response.data.analysis)
                }
            } else {
                throw new Error(response.data.error || 'Unknown error occurred')
            }
        } catch (error: unknown) {
            handleError(error as ApiErrorResponse)
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
            <div className="flex flex-col h-[calc(100vh-var(--nav-height)-var(--header-height))] bg-white">
                {/* Messages Section with Chart */}
                <div 
                    id="chat-container"
                    className="flex-1 overflow-y-auto relative"
                >
                    <div className="max-w-3xl mx-auto p-4 space-y-6">
                        
                        
                        {/* Messages follow */}
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
                                    <AnimatedMessage content={message.content} />
                                    {message.type === 'data' && message.data && (
                                        <div className="mt-6 space-y-6">
                                            <StockDataDisplay 
                                                data={message.data as StockData} 
                                                symbol={currentTicker} 
                                            />
                                        </div>
                                    )}
                                    {message.type === 'chart' ? (
                                        <div className="mt-4">
                                            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                                <div className="flex justify-between items-center p-4 border-b">
                                                    <h3 className="font-medium">{message.ticker} Price Chart</h3>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setShowCandlestick(true)}
                                                    >
                                                        Full Screen
                                                    </Button>
                                                </div>
                                                {message.ticker && (
                                                    <EnhancedTradingViewChart 
                                                        symbol={message.ticker} 
                                                        containerId={`chart-${message.ticker}-${index}`} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Input Section */}
                <div className="h-24 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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

// Remove the StockChart component and replace it with this simpler version
function StockChart({ symbol }: { symbol: string }) {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            // @ts-ignore
            new TradingView.widget({
                width: '100%',
                height: 500,
                symbol: `${symbol}`,
                interval: 'D',
                timezone: 'exchange',
                theme: 'light',
                style: '1',
                toolbar_bg: '#f1f3f6',
                enable_publishing: false,
                allow_symbol_change: true,
                container_id: `tradingview_${symbol}`,
                hide_side_toolbar: false,
            });
        };

        return () => {
            const container = document.getElementById(`tradingview_${symbol}`);
            if (container) container.innerHTML = '';
        };
    }, [symbol]);

    return <div id={`tradingview_${symbol}`} />;
}

// Add custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white border rounded-lg shadow-lg p-4">
                <p className="text-sm text-gray-600">
                    {format(new Date(data.timestamp), 'MMM dd, yyyy')}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                    ${data.close.toFixed(2)}
                </p>
                {data.volume && (
                    <p className="text-sm text-gray-500">
                        Volume: {data.volume.toLocaleString()}
                    </p>
                )}
                {data.open && (
                    <div className="text-sm text-gray-500">
                        <p>Open: ${data.open.toFixed(2)}</p>
                        <p>High: ${data.high.toFixed(2)}</p>
                        <p>Low: ${data.low.toFixed(2)}</p>
                    </div>
                )}
            </div>
        );
    }
    return null;
};


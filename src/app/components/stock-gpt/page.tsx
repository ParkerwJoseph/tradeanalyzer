'use client'

import { useState, useEffect, useMemo } from 'react'
import axios, { AxiosError } from 'axios'
import { Send, X, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageTemplate from '@/components/layout/PageTemplate'
import { useTypewriter } from '@/hooks/useTypewriter'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic'
import { useDarkMode } from '@/hooks/useDarkMode'

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

// Keep only the EnhancedTradingViewChart component for use in messages
const EnhancedTradingViewChart = ({ symbol, containerId }: { symbol: string; containerId: string }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            // @ts-expect-error TradingView widget is loaded externally
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
            <div id={containerId} className="w-full" />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
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

// Add this interface for news data
interface NewsArticle {
    id: string;
    title: string;
    url: string;
    publishDate: string;
    provider: string;
    thumbnail: string | null;
    tickers: string[];
    isPremium: boolean;
}

interface NewsData {
    articles: NewsArticle[];
    metadata: {
        totalArticles: number;
        providers: string[];
        dateRange: {
            newest: string;
            oldest: string;
        };
    };
}

// Add this component for news display
const NewsPanel = ({ ticker }: { ticker: string }) => {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchNews = async () => {
            if (!ticker) return;
            setIsLoading(true);
            try {
                const response = await axios.get(
                    `https://us-central1-shopify-webscraper.cloudfunctions.net/app/stockNews?ticker=${ticker}`
                );
                setNews(response.data.data.articles);
            } catch (error) {
                console.error('Error fetching news:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, [ticker]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg dark:text-white">Latest News</h3>
            <div className="space-y-4">
                {news.map((article) => (
                    <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex gap-4">
                            {article.thumbnail && (
                                <div className="flex-shrink-0">
                                    <img
                                        src={article.thumbnail}
                                        alt=""
                                        className="w-20 h-20 object-cover rounded"
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm line-clamp-2 dark:text-white">
                                    {article.title}
                                </h4>
                                <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
                                    {article.provider} • {format(new Date(article.publishDate), 'MMM d, yyyy')}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

// Add new interfaces for the AI response
interface AIQueryResponse {
    success: boolean;
    response?: string;
    error?: string;
}

interface ParsedAIResponse {
    function: string;
    ticker: string;
}

// Add function to parse AI response
const parseAIResponse = (response: string): ParsedAIResponse => {
    const parts = response.trim().split(' ');
    if (parts.length === 2) {
        return {
            function: parts[0].toLowerCase(),
            ticker: parts[1].toUpperCase()
        };
    }
    return {
        function: 'unknown',
        ticker: 'UNKNOWN'
    };
};

// Add basic type for response
interface GPTResponse {
    success: boolean;
    response?: string;
    error?: string;
}

// Separate function to handle the AI query
const SYSTEM_PROMPT = `You are an AI assistant that analyzes user input about stock-related queries. Your task is to:

Identify the function the user is asking for (e.g., "options," "analyze," "price," "volume," etc.).
Extract the ticker symbol associated with the query. If the query uses a company name, map it to its stock ticker symbol (e.g., "Apple" → "AAPL").
Output Format:
Return only the result as: function TICKER.

Examples:

Input: "What are the options volume on Apple?"
Output: options AAPL
Input: "Analyze Tesla's stock performance."
Output: analyze TSLA
Input: "Can you check the price of Microsoft?"
Output: price MSFT
Input: "How is Google doing?"
Output: unknown UNKNOWN
If no ticker is found, or the input is unclear, always return: unknown UNKNOWN.

User Query: `;

const queryAI = async (input: string): Promise<string> => {
    try {
        const fullPrompt = SYSTEM_PROMPT + input;
        
        const response = await fetch(
            'https://us-central1-personalgpt-55bef.cloudfunctions.net/app/basicQuestion?q=' + 
            encodeURIComponent(`"${fullPrompt}"`),
            {
                method: 'POST',
                redirect: 'follow'
            }
        );

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error('AI Query Error:', error);
        throw error;
    }
};

// Main Component
export default function StockAnalyzerPage() {
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTicker, setCurrentTicker] = useState<string>('');
    const [showCandlestick, setShowCandlestick] = useState(false);
    const [tickerSymbols, setTickerSymbols] = useState<string[]>([]);
    const [error, setError] = useState<string>('');
    const { isDark, toggleDarkMode } = useDarkMode();

    const tickerPatterns = {
        dollarSymbol: /\$([A-Za-z]{1,5})\b/,
        standardFormat: /\b(?:of|at|is|about|analyze|for)\s+([A-Za-z]{1,5})\b/i,
        standalone: /\b([A-Za-z]{1,5})\b/,
    }

    const addMessage = (
        type: ConversationMessage['type'],
        content: string,
        data?: Partial<StockData> & { ticker?: string }
    ) => {
        const newMessage: ConversationMessage = {
            type,
            content,
            timestamp: new Date(),
            data,
            ticker: data?.ticker
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const extractTicker = (input: string): string | null => {
        // Match either $TICKER or just TICKER format
        const match = input.match(/\$?([A-Za-z]{1,5})/);
        return match ? match[1].toUpperCase() : null;
    };

    // Update the handleError function with Axios error type
    const handleError = (error: ApiErrorResponse) => {
        if ('response' in error && error.response?.data) {
            setError(error.response.data.message || 'An error occurred while fetching data');
        } else {
            setError(error.message || 'An unexpected error occurred');
        }
        setIsLoading(false);
    };

    // Simplified analyzeStock
    const analyzeStock = async (ticker: string) => {
        try {
            const upperTicker = ticker.toUpperCase();
            setCurrentTicker(upperTicker);
            
            addMessage('system', `Analyzing ${upperTicker}...`);

            const response = await fetch(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${upperTicker}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch stock data');
            }

            const data = await response.json();

            if (data.success && data.data) {
                addMessage('data', `Here are the current metrics for ${upperTicker}:`, {
                    ...data.data,
                    ticker: upperTicker
                });

                if (data.analysis) {
                    addMessage('system', data.analysis);
                }
            } else {
                throw new Error(data.message || 'Failed to analyze stock');
            }
        } catch (error) {
            console.error('Analysis Error:', error);
            addMessage('error', `Unable to analyze ${ticker}. Please try again.`);
        }
    };

    // Simplified handleSubmit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        // Add user's message and clear input
        addMessage('user', trimmedInput);
        setInput('');
        
        try {
            setIsLoading(true);

            // Get AI response
            const aiResponse = await queryAI(trimmedInput);
            console.log('Processed AI Response:', aiResponse);

            // Extract ticker (last word from response)
            const parts = aiResponse.split(' ');
            const ticker = parts[parts.length - 1];

            if (ticker && ticker !== 'UNKNOWN') {
                await analyzeStock(ticker);
            } else {
                addMessage('system', 'I couldn\'t identify a specific stock in your question. Please try asking about a specific company or use a stock symbol.');
            }

        } catch (error) {
            console.error('Submit Error:', error);
            addMessage('error', 'Sorry, I had trouble processing your request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Add new data fetching functions
    const fetchOptionsData = async (ticker: string) => {
        try {
            setCurrentTicker(ticker);
            addMessage('system', `Fetching options data for ${ticker}...`);

            const response = await axios.get(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/unusualOptions?ticker=${ticker}`
            );

            if (response.data.success) {
                addMessage('data', `Here's the options analysis for ${ticker}:`, {
                    ...response.data.data,
                    ticker
                });
            } else {
                throw new Error(response.data.message || 'Failed to fetch options data');
            }
        } catch (error) {
            console.error('Options data error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            addMessage('error', `Error fetching options data for ${ticker}: ${errorMessage}`);
        }
    };

    const fetchPriceData = async (ticker: string) => {
        try {
            setCurrentTicker(ticker);
            addMessage('system', `Fetching price data for ${ticker}...`);

            const response = await axios.get(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${ticker}`
            );

            if (response.data.success && response.data.data) {
                const priceData = response.data.data;
                addMessage('data', `Current price data for ${ticker}:`, {
                    price: priceData.price,
                    changes: priceData.changes,
                    ticker
                });
            } else {
                throw new Error(response.data.message || 'Failed to fetch price data');
            }
        } catch (error) {
            console.error('Price data error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            addMessage('error', `Error fetching price data for ${ticker}: ${errorMessage}`);
        }
    };

    const fetchVolumeData = async (ticker: string) => {
        try {
            setCurrentTicker(ticker);
            addMessage('system', `Fetching volume data for ${ticker}...`);

            const response = await axios.get(
                `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${ticker}`
            );

            if (response.data.success && response.data.data) {
                const volumeData = response.data.data;
                addMessage('data', `Volume analysis for ${ticker}:`, {
                    tradingData: volumeData.tradingData,
                    ticker
                });
            } else {
                throw new Error(response.data.message || 'Failed to fetch volume data');
            }
        } catch (error) {
            console.error('Volume data error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            addMessage('error', `Error fetching volume data for ${ticker}: ${errorMessage}`);
        }
    };

    // Add this effect to scroll to bottom when messages update
    useEffect(() => {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }, [messages]);

    return (
        <PageTemplate title="Stock Analyzer" description="Get AI-powered stock analysis">
            <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="fixed top-4 right-4 z-50"
            >
                {isDark ? (
                    <Sun className="h-5 w-5" />
                ) : (
                    <Moon className="h-5 w-5" />
                )}
            </Button>

            <div className="flex h-[calc(100vh-var(--nav-height)-var(--header-height))]">
                {/* Chat Section */}
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
                    <div 
                        id="chat-container"
                        className="flex-1 overflow-y-auto relative"
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
                                                ? 'bg-destructive/10 text-destructive dark:bg-destructive/20'
                                                : message.type === 'data'
                                                ? 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                                : 'bg-gray-100 dark:bg-gray-800'
                                        }`}
                                    >
                                        <AnimatedMessage content={message.content} />
                                        {message.type === 'data' && message.data && (
                                            <div className="mt-6">
                                                <StockDataDisplay 
                                                    data={message.data as StockData} 
                                                    symbol={message.data.ticker || currentTicker} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Input Section */}
                    <div className="h-24 border-t bg-white/80 dark:bg-gray-900/80 dark:border-gray-700 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
                        <div className="max-w-3xl mx-auto p-4">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about a stock (e.g., 'Analyze AAPL' or '$TSLA')"
                                    disabled={isLoading}
                                    className="rounded-full border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                                <Button 
                                    type="submit" 
                                    disabled={isLoading || !input.trim()}
                                    className="rounded-full"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* News Panel */}
                {currentTicker && (
                    <div className="w-96 border-l bg-gray-50 dark:bg-gray-800 dark:border-gray-700 overflow-y-auto p-4">
                        <NewsPanel ticker={currentTicker} />
                    </div>
                )}
            </div>

            {/* Fullscreen Chart Modal */}
            {showCandlestick && currentTicker && (
                <div className="fixed inset-0 bg-black/90 z-50">
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
                    <div className="h-full p-4">
                        <EnhancedTradingViewChart 
                            symbol={currentTicker} 
                            containerId={`fullscreen-chart`} 
                        />
                    </div>
                </div>
            )}
        </PageTemplate>
    )
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


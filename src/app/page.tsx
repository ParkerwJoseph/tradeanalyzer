'use client';

import React, { useState, useEffect, useMemo, createContext, useContext, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Send, X, Moon, Sun, Plus, ChevronLeft, ChevronRight, Loader2, Search, Newspaper, User, Compass, Library, BookmarkIcon, LineChart, Menu, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTypewriter } from '@/hooks/useTypewriter'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import axios from 'axios'
import { format } from 'date-fns'
import PageTemplate from '@/components/layout/PageTemplate'
import { useTheme } from "next-themes"
import { useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { trackUserQuestion, logUserActivity, saveConversation, trackTickerSearch} from '@/lib/userStore'
import { ref, get, set } from 'firebase/database'
import { database } from '@/lib/firebase'
import { OpenAI } from 'openai'
import { ScrollingQuestions } from '@/components/ScrollingQuestions'

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
        fiftyDayMA?: number;
        twoHundredDayMA?: number;
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
    riskAnalysis?: {
        riskToleranceScore?: number;
    };
    options?: {
        putCallRatio: number;
        callVolume: number;
        putVolume: number;
        unusualStrikes?: {
            calls: Array<OptionStrike>;
            puts: Array<OptionStrike>;
        };
    };
}

interface ConversationMessage {
    id: string;
    type: 'user' | 'system' | 'error' | 'data' | 'chart';
    content: string;
    timestamp: Date;
    data?: Partial<StockData>;
    ticker?: string;
    intent?: string;
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
        let isMounted = true;
        const formattedSymbol = `${symbol.toUpperCase()}`;

        // Create container if it doesn't exist
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Load TradingView script
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;

        // Configure the widget
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": formattedSymbol,
            "interval": "D",
            "timezone": "exchange",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "backgroundColor": "rgba(10, 10, 10, 1)",
            "gridColor": "rgba(30, 34, 45, 1)",
            "hide_top_toolbar": true,
            "hide_legend": true,
            "save_image": false,
            "calendar": false,
            "hide_volume": false,
            "support_host": "https://www.tradingview.com",
            "container_id": containerId,
            "studies": [
                "Volume@tv-basicstudies",
                "BB@tv-basicstudies",
                "VWAP@tv-basicstudies"
            ],
            "overrides": {
                "mainSeriesProperties.candleStyle.upColor": "#00C805",
                "mainSeriesProperties.candleStyle.downColor": "#FF3B69",
                "mainSeriesProperties.candleStyle.borderUpColor": "#00C805",
                "mainSeriesProperties.candleStyle.borderDownColor": "#FF3B69",
                "mainSeriesProperties.candleStyle.wickUpColor": "#00C805",
                "mainSeriesProperties.candleStyle.wickDownColor": "#FF3B69"
            }
        });

        // Add script to container
        container.appendChild(script);

        // Handle loading state
        script.onload = () => {
            if (isMounted) {
                setIsLoading(false);
            }
        };

        return () => {
            isMounted = false;
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [symbol, containerId]);

    return (
        <div className="relative rounded-xl overflow-hidden bg-[#0A0A0A]">
            <div id={containerId} className="w-full h-[600px]" />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            )}
        </div>
    );
};

function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
}

function formatLargeNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
}

function safeNumberFormat(value: any, prefix: string = ''): string {
    if (value === undefined || value === null || isNaN(Number(value))) {
        return 'N/A';
    }
    return `${prefix}${Number(value).toFixed(2)}`;
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

// Add the new AnimatedMessage component
const AnimatedMessage = ({ content, isNew = false, type = 'user' }: { content: string, isNew: boolean, type?: string }) => {
  // Clean the text by removing special characters and markdown-style formatting
  const cleanText = (text: string) => {
    return text
      .replace(/#+\s*/g, '')    // Remove all # characters and following spaces
      .replace(/\*\*/g, '')     // Remove bold markers
      .replace(/\*/g, '')       // Remove single asterisks
      .replace(/`/g, '')        // Remove code markers
      .replace(/\[|\]/g, '')    // Remove square brackets
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
      .replace(/^[-•]/gm, '')   // Remove list markers at start of lines
      .trim();
  };

  const cleanedText = cleanText(content);
  const { displayedText, isTyping } = useTypewriter(cleanedText, isNew ? 30 : 0);
  
  return (
    <div className="whitespace-pre-wrap">
      {isNew ? displayedText : cleanedText}
      {isTyping && isNew && <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse"/>}
      {type === 'system' && (
        <div className="text-xs text-gray-400 mt-4 border-t border-gray-700 pt-4">
          Disclaimer: This analysis is for informational purposes only and should not be considered as financial or trading advice. Always conduct your own research and consult with a licensed financial advisor before making investment decisions.
        </div>
      )}
    </div>
  )
};

// Update the MetricCard component with a more modern design
const MetricCard = ({ title, metrics }: { 
  title: string; 
  metrics: Array<{ label: string; value: string }> 
}) => (
  <div className="bg-[#0F0F10]/40 backdrop-blur-md border border-white/5 rounded-xl p-3 md:p-4 min-w-[200px] md:min-w-[260px] flex-shrink-0">
    <h3 className="text-[12px] md:text-[13px] font-medium mb-2 md:mb-3 text-white/50 uppercase tracking-wider">
      {title}
    </h3>
    <div className="space-y-1.5 md:space-y-2">
      {metrics.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <span className="text-[#808080] text-[10px] md:text-[11px] uppercase tracking-wider">
            {label}
          </span>
          <span className="font-semibold text-white text-sm md:text-base">
            {value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Add a new SuggestedQuestion component
const SuggestedQuestion = ({ question, onClick }: { question: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-sm px-4 py-2 rounded-full border border-white/5 bg-[#0F0F10]/40 
    hover:bg-[#0F0F10]/60 transition-all duration-200 hover:border-white/10 text-white/70 
    hover:text-white/90 backdrop-blur-md whitespace-nowrap"
  >
    {question}
  </button>
);

// Add a RelatedQuestion component
const RelatedQuestion = ({ question, onClick }: { question: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 hover:bg-[#0F0F10]/40 
    transition-all duration-200 group border-b border-white/5"
  >
    <span className="text-white/80 text-lg group-hover:text-white/90">{question}</span>
    <span className="text-[#4AACF3] text-2xl opacity-0 group-hover:opacity-100 transition-opacity">+</span>
  </button>
);

// Memoize the EnhancedTradingViewChart component
const MemoizedTradingViewChart = memo(EnhancedTradingViewChart);

// Add near other interfaces at the top
interface OptionStrike {
  strike: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  percentFromPrice: number;
}

// Update the StockDataDisplay component to show detailed options data
const StockDataDisplay = ({ data, analysis }: { 
  data: {
    ticker: string;
    price: { current: number };
    changes: { daily: string };
    options?: {
      putCallRatio: number;
      callVolume: number;
      putVolume: number;
      unusualStrikes?: {
        calls: OptionStrike[];
        puts: OptionStrike[];
      };
    };
    technicals?: {
      rsi: number;
      macd: { macd: number; signal: number };
    };
    technicalLevels?: {
      fiftyDayMA: number;
      twoHundredDayMA: number;
      support: number;
      resistance: number;
    };
  },
  analysis: { intent: string }
}) => {
  // Use a stable chart ID based on the ticker
  const chartId = useMemo(() => `chart-${data.ticker}`, [data.ticker]);

  return (
    <div className="font-mono whitespace-pre-wrap text-sm space-y-4">
      <div className="text-yellow-400 font-bold mb-4">Analysis Results:</div>

      <div className="mb-4">
        <div className="text-blue-400 font-bold text-base md:text-lg">
          {data.ticker} ${data.price.current.toFixed(2)} ({data.changes.daily})
        </div>
      </div>

      {/* TradingView Chart */}
      <div className="h-[300px] md:h-[600px] w-full mb-6 bg-[#0F0F10] rounded-lg overflow-hidden border border-white/5">
        <MemoizedTradingViewChart 
          symbol={data.ticker} 
          containerId={chartId}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.technicalLevels && (
          <div className="bg-[#0F0F10]/40 p-3 md:p-4 rounded-lg border border-white/5">
            <div className="text-yellow-400 font-bold mb-2 text-sm md:text-base">Technical Levels</div>
            <div className="space-y-1 text-xs md:text-sm">
              <div className="flex justify-between">
                <span>50-Day MA:</span>
                <span>${data.technicalLevels.fiftyDayMA?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>200-Day MA:</span>
                <span>${data.technicalLevels.twoHundredDayMA?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Support:</span>
                <span>${data.technicalLevels.support?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Resistance:</span>
                <span>${data.technicalLevels.resistance?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {data.technicals && (
          <div className="bg-[#0F0F10]/40 p-3 md:p-4 rounded-lg border border-white/5">
            <div className="text-yellow-400 font-bold mb-2 text-sm md:text-base">Technical Indicators</div>
            <div className="space-y-1 text-xs md:text-sm">
              <div className="flex justify-between">
                <span>RSI:</span>
                <span>{data.technicals.rsi?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>MACD:</span>
                <span>{data.technicals.macd?.macd?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Signal:</span>
                <span>{data.technicals.macd?.signal?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {data.options && (
        <div className="bg-[#0F0F10]/40 p-3 md:p-4 rounded-lg border border-white/5 mt-4">
          <div className="text-yellow-400 font-bold mb-2 text-sm md:text-base">Options Overview</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
            <div className="flex justify-between md:block">
              <span>Put/Call Ratio:</span>
              <span>{data.options.putCallRatio?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="flex justify-between md:block">
              <span>Call Volume:</span>
              <span>{data.options.callVolume?.toLocaleString() || 'N/A'}</span>
            </div>
            <div className="flex justify-between md:block">
              <span>Put Volume:</span>
              <span>{data.options.putVolume?.toLocaleString() || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] md:text-xs text-gray-400 mt-4 border-t border-gray-700 pt-4">
        Disclaimer: This analysis is for informational purposes only and should not be considered as financial or trading advice. Always conduct your own research and consult with a licensed financial advisor before making investment decisions.
      </div>
    </div>
  );
};

// Add this context at the top of your file
const InputContext = createContext<[string, (value: string) => void]>(['', () => {}]);

// Update your existing NewsPanel component with the new styling
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
          <h3 className="font-semibold text-lg text-foreground">Latest News</h3>
          <div className="space-y-4">
              {news.map((article) => (
                  <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
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
                              <h4 className="font-medium text-sm line-clamp-2 text-card-foreground">
                                  {article.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
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

// Add the utility function
function formatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}

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
const parseAIResponse = (response: StockAnalysisResponse): ParsedAIResponse => {
    const parts = response.answer.trim().split(' ');
    return {
        function: parts[0]?.toLowerCase() || 'unknown',
        ticker: parts[1]?.toUpperCase() || 'UNKNOWN'
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
Output: analyze GOOGL

If no ticker is found, or the input is unclear, always return: unknown UNKNOWN.

User Query: `;

// Add this interface at the top with your other types
interface ChatSession {
    id: string;
    title: string;
    timestamp: Date;
    messages: ConversationMessage[];
}

interface NewsArticle {
    id: string;
    title: string;
    url: string;
    thumbnail?: string;
    provider: string;
    publishDate: string;
}

// Types
interface ApiErrorResponse {
    response?: {
        data?: {
            message?: string;
        };
    };
    message?: string;
}

// Add a Recommendations component
const Recommendations = ({ content }: { content: string }) => {
  const recommendations = content.split('\n').filter(line => line.trim().startsWith('**'));
  
  return (
    <div className="mt-4 bg-[#0F0F10]/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium text-white/90">Key Points</span>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {recommendations.map((rec, index) => {
          const [title, ...description] = rec.split(':');
          return (
            <div key={index} className="p-4 hover:bg-white/5 transition-colors">
              <div className="text-white/90 font-medium">
                {title.replace(/\*\*/g, '')}
              </div>
              <div className="text-white/70 text-sm mt-1">
                {description.join(':').trim()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Add a QuickSuggestion component
const QuickSuggestion = ({ question, onClick }: { question: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="px-4 py-2 rounded-full bg-[#0F0F10]/40 border border-white/5 
    hover:bg-[#0F0F10]/60 transition-all duration-200 hover:border-white/10 
    text-white/70 hover:text-white/90 text-sm whitespace-nowrap backdrop-blur-sm
    flex-shrink-0"
  >
    {question}
  </button>
);

interface YahooFinanceResponse {
  quoteSummary?: {
    result?: [{
      price?: any;
      summaryDetail?: any;
      defaultKeyStatistics?: any;
      financialData?: any;
      recommendationTrend?: any;
    }];
    error?: any;
  };
}

const handleFollowUpQuestion = async (
  question: string, 
  ticker: string,
  setShowNews: (show: boolean) => void,
  addMessage: (type: ConversationMessage['type'], content: string, data?: Partial<StockData>) => void
) => {
  if (!ticker) {
    addMessage('error', 'No stock is currently being analyzed. Please specify a stock symbol first.');
    return;
  }

  const lowerQuestion = question.toLowerCase();
  const YAHOO_API_BASE = 'https://query1.finance.yahoo.com/v10/finance';
  
  try {
    if (lowerQuestion.includes('news')) {
      setShowNews(true);
      return;
    }

    // Get basic quote data
    const response = await axios.get<YahooFinanceResponse>(
      `${YAHOO_API_BASE}/quoteSummary/${ticker}`,
      {
        params: {
          modules: 'price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend',
        }
      }
    );

    const data = response.data.quoteSummary?.result?.[0];
    if (!data) throw new Error('No data returned from Yahoo Finance');

    if (lowerQuestion.includes('technical') || lowerQuestion.includes('analysis')) {
      const technicalData = {
        price: data.price?.regularMarketPrice?.raw,
        previousClose: data.price?.regularMarketPreviousClose?.raw,
        fiftyDayAvg: data.summaryDetail?.fiftyDayAverage?.raw,
        twoHundredDayAvg: data.summaryDetail?.twoHundredDayAverage?.raw,
        fiftyTwoWeek: {
          low: data.summaryDetail?.fiftyTwoWeekLow?.raw,
          high: data.summaryDetail?.fiftyTwoWeekHigh?.raw
        }
      };
      
      addMessage('data', 'Technical Analysis:', {
        price: {
          current: technicalData.price,
          previousClose: technicalData.previousClose,
          fiftyDayMA: technicalData.fiftyDayAvg,
          twoHundredDayMA: technicalData.twoHundredDayAvg,
          fiftyTwoWeek: technicalData.fiftyTwoWeek
        },
        technicalLevels: {
          fiftyDayMA: technicalData.fiftyDayAvg,
          twoHundredDayMA: technicalData.twoHundredDayAvg,
          support: technicalData.fiftyTwoWeek.low,
          resistance: technicalData.fiftyTwoWeek.high
        }
      });
      return;
    }

    if (lowerQuestion.includes('price') || lowerQuestion.includes('level')) {
      const priceData = {
        current: data.price?.regularMarketPrice?.raw,
        open: data.price?.regularMarketOpen?.raw,
        high: data.price?.regularMarketHigh?.raw,
        low: data.price?.regularMarketLow?.raw,
        previousClose: data.price?.regularMarketPreviousClose?.raw,
        change: data.price?.regularMarketChange?.raw,
        changePercent: data.price?.regularMarketChangePercent?.raw
      };
      
      addMessage('data', 'Price Information:', {
        price: {
          current: priceData.current,
          previousClose: priceData.previousClose,
          dayRange: {
            low: priceData.low,
            high: priceData.high
          }
        },
        changes: {
          daily: `${priceData.change?.toFixed(2)} (${priceData.changePercent?.toFixed(2)}%)`,
          momentum: 'N/A',
          trendStrength: 'N/A'
        }
      });
      return;
    }

    if (lowerQuestion.includes('volume') || lowerQuestion.includes('trading')) {
      const volumeData = {
        volume: data.price?.regularMarketVolume?.raw,
        avgVolume: data.price?.averageDailyVolume3Month?.raw,
        volumeRatio: data.price?.regularMarketVolume?.raw / data.price?.averageDailyVolume3Month?.raw
      };
      
      addMessage('data', 'Volume Analysis:', {
        tradingData: {
          volume: volumeData.volume,
          avgVolume: volumeData.avgVolume,
          volumeRatio: volumeData.volumeRatio
        }
      });
      return;
    }

    if (lowerQuestion.includes('financial') || lowerQuestion.includes('metric')) {
      const financialData = {
        marketCap: data.price?.marketCap?.raw,
        peRatio: data.summaryDetail?.trailingPE?.raw,
        forwardPE: data.summaryDetail?.forwardPE?.raw,
        eps: data.defaultKeyStatistics?.trailingEps?.raw,
        beta: data.defaultKeyStatistics?.beta?.raw
      };
      
      addMessage('data', 'Financial Metrics:', {
        valuationMetrics: {
          marketCap: financialData.marketCap,
          peRatio: financialData.peRatio,
          forwardPE: financialData.forwardPE
        },
        tradingData: {
          volume: data.price?.regularMarketVolume?.raw || 0,
          avgVolume: data.price?.averageDailyVolume3Month?.raw || 0,
          volumeRatio: (data.price?.regularMarketVolume?.raw || 0) / (data.price?.averageDailyVolume3Month?.raw || 1),
          beta: financialData.beta
        }
      });
      return;
    }

    // Default fallback - show comprehensive analysis
    const comprehensiveData = {
      price: data.price?.regularMarketPrice?.raw,
      marketCap: data.price?.marketCap?.raw,
      peRatio: data.summaryDetail?.trailingPE?.raw,
      volume: data.price?.regularMarketVolume?.raw,
      avgVolume: data.price?.averageDailyVolume3Month?.raw,
      fiftyDayAvg: data.summaryDetail?.fiftyDayAverage?.raw,
      twoHundredDayAvg: data.summaryDetail?.twoHundredDayAverage?.raw,
      support: 0,
      resistance: 0
    };
    
    addMessage('data', 'Comprehensive Analysis:', {
      price: {
        current: comprehensiveData.price,
        previousClose: data.price?.regularMarketPreviousClose?.raw || comprehensiveData.price
      },
      valuationMetrics: {
        marketCap: comprehensiveData.marketCap,
        peRatio: comprehensiveData.peRatio
      },
      tradingData: {
        volume: comprehensiveData.volume,
        avgVolume: comprehensiveData.avgVolume,
        volumeRatio: comprehensiveData.volume / comprehensiveData.avgVolume
      },
      technicalLevels: {
        fiftyDayMA: comprehensiveData.fiftyDayAvg,
        twoHundredDayMA: comprehensiveData.twoHundredDayAvg,
        support: comprehensiveData.support || 0,
        resistance: comprehensiveData.resistance || 0
      }
    });
    
  } catch (error) {
    console.error('Follow-up question error:', error);
    addMessage('error', `Failed to fetch data for ${ticker} from Yahoo Finance. Please try again.`);
  }
};

// Add this interface near other interfaces
interface SimilarTicker {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
}

// Update the SimilarTickers component
const SimilarTickers = ({ tickers, onAnalyze }: { tickers: SimilarTicker[], onAnalyze: (symbol: string) => void }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
    {tickers.map((ticker) => (
      <button
        key={ticker.symbol}
        className="px-4 py-2 rounded-full bg-[#0F0F10]/40 border border-white/5 
        hover:bg-[#0F0F10]/60 transition-all duration-200 hover:border-white/10 
        text-white/70 hover:text-white/90 text-sm whitespace-nowrap backdrop-blur-sm
        flex-shrink-0"
        onClick={() => onAnalyze(ticker.symbol)}
      >
        What do you think of {ticker.shortName}?
      </button>
    ))}
  </div>
);

// Add this function to fetch similar tickers
const fetchSimilarTickers = async (ticker: string): Promise<SimilarTicker[]> => {
  try {
    const response = await axios.get(
      `https://yahoo-finance166.p.rapidapi.com/api/stock/get-recommendation-by-symbol`,
      {
        params: {
          region: 'US',
          symbol: ticker
        },
        headers: {
          'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
          'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
        }
      }
    );

    if (!response.data?.finance?.result?.[0]?.quotes) {
      return [];
    }

    return response.data.finance.result[0].quotes
      .filter((quote: any) => quote.symbol !== ticker)
      .map((quote: any) => ({
        symbol: quote.symbol,
        shortName: quote.shortName,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChangePercent: quote.regularMarketChangePercent
      }));
  } catch (error) {
    console.error('Error fetching similar tickers:', error);
    return [];
  }
};

// Utility function to bold text between ** and remove the markers
function formatBoldText(content: string): string {
  return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Example usage in a component
const FormattedText = ({ content }: { content: string }) => (
  <div dangerouslySetInnerHTML={{ __html: formatBoldText(content) }} />
);

interface SelectedConversation {
    messages: ConversationMessage[];
    title: string;
    id: string;
}

// Add this helper function near other utility functions
const calculateTechnicalRiskScore = (stockData: any): number => {
    let riskScore = 5; // Start at middle of 1-10 scale

    // Price relative to moving averages
    const price = stockData.price?.current || 0;
    const ma50 = stockData.technicalLevels?.fiftyDayMA || 0;
    const ma200 = stockData.technicalLevels?.twoHundredDayMA || 0;

    // Trend analysis with higher risk for downtrends
    if (price > ma50 && ma50 > ma200) {
        riskScore -= 1; // Uptrend reduces risk moderately
    } else if (price < ma50 && ma50 < ma200) {
        riskScore += 2.5; // Downtrend increases risk significantly
    }
    
    // Price below moving averages adds more risk
    if (price < ma50) riskScore += 1;
    if (price < ma200) riskScore += 1.5;

    // Volatility analysis
    const dayRange = stockData.price?.dayRange;
    if (dayRange) {
        const volatility = (dayRange.high - dayRange.low) / dayRange.low;
        riskScore += volatility * 10; // Scaled down for 1-10 range
    }

    // Volume analysis
    const volumeRatio = stockData.tradingData?.volumeRatio || 1;
    if (volumeRatio > 1.5) riskScore += 1;

    // Normalize between 1 and 10
    return Math.min(Math.max(Math.round(riskScore * 10) / 10, 10)); 
};

// Add near the top with other constants
const SAMPLE_QUESTIONS = [
  "What's the current market sentiment for AAPL?",
  "Analyze the technical indicators for TSLA",
  "Compare MSFT and GOOGL performance",
  "Explain recent volatility in META stock",
  "What are the key support levels for NVDA?",
  "Analyze the dividend history of JNJ",
  "What's causing the price movement in AMD?",
  "Show me technical analysis for AMZN",
  "Explain the P/E ratio of SPY",
  "What are the resistance levels for BTC?",
];

// Add this new component
const ScrollingQuestionss = ({ onQuestionClick }: { onQuestionClick: (question: string) => void }) => {
  return (
    <div className="relative w-full overflow-hidden py-4 before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-20 before:from-background before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-20 after:from-background after:to-transparent">
      <div className="animate-scroll flex gap-4 whitespace-nowrap">
        {[...SAMPLE_QUESTIONS, ...SAMPLE_QUESTIONS].map((question, index) => (
          <button
            key={`${question}-${index}`}
            onClick={() => onQuestionClick(question)}
            className="inline-flex px-4 py-2 rounded-full border border-white/10 bg-white/5 
                     hover:bg-white/10 transition-colors duration-500 text-sm text-white/70 
                     hover:text-white/90 whitespace-nowrap"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};

// Add this new interface for the API response
interface StockAnalysisResponse {
  success: boolean;
  data: {
    ticker: string;
    price: { current: number };
    changes: { daily: string };
    tradingData?: {
      volume: number;
      avgVolume: number;
      volumeRatio: number;
    };
    options?: {
      putCallRatio: number;
      callVolume: number;
      putVolume: number;
      unusualStrikes?: {
        calls: Array<OptionStrike>;
        puts: Array<OptionStrike>;
      };
    };
    technicals?: {
      rsi: number;
      macd: { macd: number; signal: number };
    };
    technicalLevels?: {
      fiftyDayMA: number;
      twoHundredDayMA: number;
      support: number;
      resistance: number;
    };
  };
  answer: string;
  message?: string;
}

// Update the queryAI function with better error handling
const queryAI = async (input: string): Promise<StockAnalysisResponse> => {
  try {
    const response = await axios.post(
      'https://us-central1-shopify-webscraper.cloudfunctions.net/app/askQuestion',
      {
        question: input,
        extractTicker: true
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to process question');
    }

    // If no ticker was found in the response, try to extract it locally
    if (!response.data.data?.ticker || response.data.data.ticker === 'UNKNOWN') {
      const extractedTicker = extractTickerFromText(input);
      if (extractedTicker) {
        response.data.data.ticker = extractedTicker;
      } else {
        throw new Error('No ticker symbol detected in your question. Please include a stock symbol (e.g., AAPL, MSFT, GOOGL).');
      }
    }

    return response.data;
  } catch (error) {
    console.error('AI Query Error:', error);
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      throw new Error('No ticker symbol detected in your question. Please include a stock symbol (e.g., AAPL, MSFT, GOOGL).');
    }
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    throw new Error(`Failed to analyze question: ${errorMessage}`);
  }
};

// Add improved ticker extraction function
const extractTickerFromText = (text: string): string | null => {
  // Common stock tickers
  const commonTickers = new Map([
    ['apple', 'AAPL'],
    ['microsoft', 'MSFT'],
    ['google', 'GOOGL'],
    ['amazon', 'AMZN'],
    ['tesla', 'TSLA'],
    ['meta', 'META'],
    ['facebook', 'META'],
    ['netflix', 'NFLX'],
    ['nvidia', 'NVDA']
  ]);

  // First, check for company names
  const lowercaseText = text.toLowerCase();
  for (const [company, ticker] of commonTickers.entries()) {
    if (lowercaseText.includes(company)) {
      return ticker;
    }
  }

  // Then try different patterns
  const patterns = [
    /\$([A-Za-z]{1,5})\b/i,                                    // $TICK
    /\b([A-Za-z]{1,5}):([A-Za-z]+)\b/i,                       // TICK:EXCHANGE
    /\b(?:of|for|in|about|analyze|check)\s+([A-Za-z]{1,5})\b/i,  // Common phrases
    /\b([A-Za-z]{1,5})\s+(?:stock|share|price|analysis)\b/i,  // TICK stock/share
    /\b([A-Za-z]{1,5})\b/                                     // Standalone ticker
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const potential = match[1].toUpperCase();
      // Basic validation: must be 1-5 characters, all letters
      if (/^[A-Z]{1,5}$/.test(potential) && !['A', 'I', 'OF', 'FOR', 'IN', 'THE', 'AND'].includes(potential)) {
        return potential;
      }
    }
  }

  return null;
};

// Add FeedbackType enum at the top of the file with other types
type FeedbackType = 'up' | 'down';

const FeedbackButtons = ({ messageId, question, answer }: { messageId: string, question: string, answer: string }) => {
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');

  const handleFeedback = async (type: FeedbackType | null) => {
    if (type === null) {
      setFeedback(null);
      setShowFeedbackInput(false);
      return;
    }

    if (feedback) return; // Prevent multiple submissions
    setFeedback(type);

    if (type === 'down') {
      setShowFeedbackInput(true);
      return; // Wait for feedback note before submitting
    }

    await submitFeedback(type);
  };

  const submitFeedback = async (type: FeedbackType, note?: string) => {
    try {
      const uid = Cookies.get('uid');
      if (!uid) return;

      const feedbackData = {
        timestamp: new Date().toISOString(),
        type,
        question: question || 'No question provided',
        answer: answer || 'No answer provided',
        feedbackNote: note || '',
        needsReview: type === 'down',
        reviewed: false
      };

      const feedbackRef = ref(database, `feedback/${uid}/${messageId}`);
      await set(feedbackRef, feedbackData);

      if (type === 'down' && note) {
        const reviewRef = ref(database, `reviews/pending/${messageId}`);
        await set(reviewRef, {
          ...feedbackData,
          userId: uid,
          status: 'pending'
        });
      }

      setShowFeedbackInput(false);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  const handleSubmitNote = async () => {
    if (!feedbackNote.trim()) return;
    await submitFeedback('down', feedbackNote);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => handleFeedback('up')}
          disabled={feedback !== null}
          className={cn(
            "p-1 rounded hover:bg-white/10 transition-colors",
            feedback === 'up' && "text-green-500"
          )}
        >
          <ThumbsUp className={cn(
            "h-4 w-4",
            feedback === 'up' ? "fill-current" : "fill-none"
          )} />
        </button>
        <button
          onClick={() => handleFeedback('down')}
          disabled={feedback !== null && !showFeedbackInput}
          className={cn(
            "p-1 rounded hover:bg-white/10 transition-colors",
            feedback === 'down' && "text-red-500"
          )}
        >
          <ThumbsDown className={cn(
            "h-4 w-4",
            feedback === 'down' ? "fill-current" : "fill-none"
          )} />
        </button>
      </div>

      {showFeedbackInput && (
        <div className="flex gap-2">
          <Input
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="What could be improved?"
            className="flex-1"
          />
          <Button
            onClick={handleSubmitNote}
            disabled={!feedbackNote.trim()}
          >
            Submit
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowFeedbackInput(false);
              setFeedback(null);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

// Add these example prompts near the top of the file
const EXAMPLE_PROMPTS = [
    {
        category: "Technical Analysis",
        prompts: [
            "Show me the technical indicators for AAPL",
            "What are the key support and resistance levels for TSLA?",
            "Analyze the moving averages for MSFT",
            "What's the RSI and MACD showing for NVDA?",
        ]
    },
    {
        category: "Options Analysis",
        prompts: [
            "What's the unusual options activity in AMD?",
            "Show me high-volume call options for META",
            "Analyze put/call ratio for AMZN",
            "What are the most active strike prices for SPY?",
        ]
    },
    {
        category: "Market Sentiment",
        prompts: [
            "What's the current market sentiment for GOOGL?",
            "How is institutional trading affecting NFLX?",
            "Show me the insider trading activity for COIN",
            "What's the short interest in GME?",
        ]
    },
    {
        category: "Fundamental Analysis",
        prompts: [
            "Compare the P/E ratios of AAPL and MSFT",
            "What's the revenue growth of AMZN?",
            "Show me the profit margins for TSLA",
            "Analyze the cash flow of META",
        ]
    }
];

// Add this at the top with other utility functions
const generateId = (() => {
    let counter = 0;
    const prefix = Math.random().toString(36).substring(2, 9);
    return (type: string = 'msg') => `${type}_${prefix}_${counter++}`;
})();

// Add this near other interfaces
interface SignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

// Add the SignupModal component
const SignupModal = ({ isOpen, onClose, message }: SignupModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-white/10 rounded-lg max-w-md w-full p-6 space-y-4">
                <h2 className="text-xl font-semibold text-white">Create an Account</h2>
                <p className="text-white/70">
                    {message}
                </p>
                <ul className="space-y-2 text-white/70">
                    <li className="flex items-center gap-2">
                        <span className="text-green-400">✓</span> Unlimited AI-powered stock analysis
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-green-400">✓</span> Personalized investment insights
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-green-400">✓</span> Advanced technical indicators
                    </li>
                </ul>
                <div className="space-y-2">
                    <Button 
                        className="w-full"
                        onClick={() => window.location.href = '/signup'}
                    >
                        Create Account
                    </Button>
                    <Button 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => window.location.href = '/login'}
                    >
                        Already have an account? Log in
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Main component that receives searchParams as a prop
const StockGPTContent = () => {
    const router = useRouter();
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTicker, setCurrentTicker] = useState<string | null>(null);
    const [showCandlestick, setShowCandlestick] = useState(false);
    const [tickerSymbols, setTickerSymbols] = useState<string[]>([]);
    const [error, setError] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showNews, setShowNews] = useState(false);
    const [navigationItems] = useState([
        { label: 'Home', path: '/' },
        { label: 'Stock Analysis', path: '/stock-analysis' },
        { label: 'Stock News', path: '/stock-news' },
        { label: 'Settings', path: '/settings' }
    ]);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [similarTickers, setSimilarTickers] = useState<SimilarTicker[]>([]);
    const [questionCount, setQuestionCount] = useState(0);
    const [showSignupModal, setShowSignupModal] = useState(false);
    const MAX_FREE_QUESTIONS = 6;
    const [guestQuestions, setGuestQuestions] = useState(() => {
        // Initialize from localStorage if available
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('guestQuestionCount');
            return stored ? parseInt(stored, 10) : 0;
        }
        return 0;
    });
    const MAX_GUEST_QUESTIONS = 1;

    const tickerPatterns = {
        dollarSymbol: /\$([A-Za-z]{1,5})\b/,
        standardFormat: /\b(?:of|at|is|about|analyze|for)\s+([A-Za-z]{1,5})\b/i,
        standalone: /\b([A-Za-z]{1,5})\b/,
    }

    const generateChatTitle = async (content: string): Promise<string> => {
        const titlePrompt = `Generate a two-word title for a chat about: "${content}". 
        Response should be exactly two words, capitalized. Example: "Stock Analysis" or "Tesla Review"`;
        
        try {
            const response = await queryAI(titlePrompt);
            return response.answer.trim();
        } catch (error) {
            console.error('Failed to generate title:', error);
            return 'New Chat';
        }
    };

    const createNewChat = () => {
        const newChatId = generateId('chat');
        const newChat: ChatSession = {
            id: newChatId,
            title: 'New Chat',
            timestamp: new Date(),
            messages: []
        };
        setChatHistory(prev => [...prev, newChat]);
        setCurrentChatId(newChatId);
        setMessages([]);
    };

    const addMessage = (type: ConversationMessage['type'], content: string, data?: Partial<StockData>) => {
        const messageId = generateId('msg');
        setMessages(prev => [...prev, {
            id: messageId,
            type,
            content,
            timestamp: new Date(),
            data,
            ticker: currentTicker || undefined
        }]);
    };

    const switchChat = (chatId: string) => {
        const chat = chatHistory.find(c => c.id === chatId);
        if (chat) {
            setCurrentChatId(chatId);
            setMessages(chat.messages);
        }
    };

    const extractTicker = (input: string): string | null => {
        // Look for "about TICKER" pattern specifically
        const match = input.match(/about\s+(\$?[A-Za-z]{1,5})/i);
        return match ? match[1].replace('$', '').toUpperCase() : null;
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

    // Modify the analyzeStock function to show news automatically
    const analyzeStock = async (ticker: string) => {
        try {
            await trackTickerSearch(ticker);
            setCurrentTicker(ticker);
            setIsLoading(true);
            addMessage('system', `Analyzing ${ticker}...`);

            // Get user's risk profile from Firebase
            const uid = Cookies.get('uid');
            if (uid) {
                const userRef = ref(database, `users/${uid}/riskAnalysis`);
                const snapshot = await get(userRef);
                const riskProfile = snapshot.val();
                
                // Construct the URL with risk tolerance if available
                const baseUrl = `https://us-central1-shopify-webscraper.cloudfunctions.net/app/analyzeStock?ticker=${ticker}&detailed=true`;
                const url = riskProfile?.riskToleranceScore 
                    ? `${baseUrl}&riskTolerance=${riskProfile.riskToleranceScore}&riskLevel=${riskProfile.riskLevel}`
                    : baseUrl;

                const response = await axios.get(url);

                if (response.data.success) {
                    const stockData = response.data.data;
                    const technicalRiskScore = calculateTechnicalRiskScore(stockData);
                    
                    setMessages(prev => [
                        ...prev.slice(0, -1),
                        {
                            id: generateId('data'),
                            type: 'data' as const,
                            content: `Here are the key metrics for ${ticker}:`,
                            timestamp: new Date(),
                            data: {
                                ...stockData,
                                ticker: ticker.toUpperCase(),
                                riskAnalysis: {
                                    ...riskProfile,
                                    riskToleranceScore: technicalRiskScore,
                                    technicalRiskLevel: technicalRiskScore > 7 ? 'High' : 
                                                    technicalRiskScore > 4 ? 'Medium' : 'Low'
                                }
                            },
                            ticker: ticker.toUpperCase()
                        },
                        {
                            id: generateId('system'),
                            type: 'system' as const,
                            content: response.data.analysis,
                            timestamp: new Date(),
                            ticker: ticker.toUpperCase()
                        }
                    ].filter(msg => msg.content !== undefined));

                    // Fetch similar tickers and show news
                    const similarTickersData = await fetchSimilarTickers(ticker);
                    setSimilarTickers(similarTickersData);
                    setShowNews(true);
                } else {
                    throw new Error(response.data.message || 'Failed to analyze stock');
                }
            }
        } catch (error) {
            console.error('Analysis error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            addMessage('error', `Error analyzing ${ticker}: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Add this function to check authentication
    const checkAuthAndIncrementCount = () => {
        const uid = Cookies.get('uid');
        if (!uid) {
            // Guest mode
            if (guestQuestions >= MAX_GUEST_QUESTIONS) {
                setShowSignupModal(true);
                return false;
            }
            setGuestQuestions(prev => prev + 1);
        }
        return true;
    };

    // Update handleSubmit to check auth
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        
        // Check auth before proceeding
        if (!checkAuthAndIncrementCount()) {
            return;
        }
        
        try {
            setIsLoading(true);
            addMessage('user', input);

            const response = await queryAI(input);
            
            if (response.data) {
                const stockData: Partial<StockData> = {
                    ticker: response.data.ticker || 'UNKNOWN',
                    price: {
                        current: response.data.price?.current || 0,
                        previousClose: response.data.price?.current || 0
                    },
                    changes: {
                        daily: response.data.changes?.daily || '0%',
                        momentum: 'N/A',
                        trendStrength: 'N/A'
                    },
                    technicalLevels: {
                        fiftyDayMA: response.data.technicalLevels?.fiftyDayMA || 0,
                        twoHundredDayMA: response.data.technicalLevels?.twoHundredDayMA || 0,
                        support: response.data.technicalLevels?.support || 0,
                        resistance: response.data.technicalLevels?.resistance || 0
                    },
                    tradingData: {
                        volume: response.data.tradingData?.volume || 0,
                        avgVolume: response.data.tradingData?.avgVolume || 0,
                        volumeRatio: response.data.tradingData?.volumeRatio || 1
                    }
                };
                addMessage('data', '', stockData);
            }
            
            if (response.answer) {
                addMessage('system', response.answer);
            }
            
            setInput('');
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            addMessage('error', errorMessage);
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
                    changes: {
                        daily: priceData.changes?.daily || 'N/A',
                        momentum: priceData.changes?.momentum || 'N/A',
                        trendStrength: priceData.changes?.trendStrength || 'N/A'
                    },
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

    // Add this effect to handle mounting
    useEffect(() => {
        setMounted(true);
    }, []);

    // Example of using useEffect for client-side only code
    useEffect(() => {
        // Code that relies on the window object or needs to run only on the client
        if (typeof window !== 'undefined') {
            // Client-side logic here
        }
    }, []);

    useEffect(() => {
        // Check for pending query on component mount
        const pendingQuery = localStorage.getItem('pendingStockQuery');
        if (pendingQuery) {
            // Clear the pending query immediately to prevent reuse
            localStorage.removeItem('pendingStockQuery');
            
            // Add the user's question to the chat first
            addMessage('user', pendingQuery);
            
            // Extract and analyze the ticker
            const ticker = extractTicker(pendingQuery);
            if (ticker) {
                analyzeStock(ticker);
            } else {
                addMessage('error', 'Unable to identify a valid stock symbol in your query.');
            }
        }
    }, []); // Run once on component mount

    // Add this inside the StockGPT component, near other event handlers
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    // Add this effect to persist guest question count
    useEffect(() => {
        localStorage.setItem('guestQuestionCount', guestQuestions.toString());
    }, [guestQuestions]);

    // Update SignupModal text to show remaining questions
    const getSignupModalContent = () => {
        const remainingQuestions = MAX_GUEST_QUESTIONS - guestQuestions;
        if (remainingQuestions <= 0) {
            return "You've reached the limit for guest questions. Sign up to get:";
        }
        return `You have ${remainingQuestions} questions remaining in guest mode. Sign up to get:`;
    };

    return (
    <PageTemplate title="" description="">
        <div className="flex flex-col h-full fixed inset-0 pt-14 bg-[#0A0A0A]">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <div className="p-4 md:p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {messages.length === 0 ? (
                            <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center px-4 py-6">
                                {/* Hero Section */}
                                <div className="mb-4 md:mb-16 space-y-4">
                                    <h1 className="text-3xl md:text-7xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-transparent bg-clip-text">
                                        StocX AI
                                    </h1>
                                    <p className="text-base md:text-2xl text-white/70 max-w-2xl mx-auto px-2 md:px-4">
                                        Your AI-powered stock analysis assistant
                                    </p>
                                </div>

                                {/* Add ScrollingQuestions here */}
                                <div className="w-full mb-6">
                                    <ScrollingQuestionss onQuestionClick={(question) => setInput(question)} />
                                </div>

                                {/* Search Bar */}
                                <div className="w-full max-w-3xl px-4 mb-8">
                                    <div className="relative">
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ask about any stock..."
                                            className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/50 
                                                     rounded-2xl h-12 md:h-16 px-4 md:px-6 pr-16 md:pr-20 transition-all duration-200 
                                                     hover:bg-white/10 text-base md:text-lg shadow-lg"
                                        />
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-2 top-2 h-8 w-8 md:h-12 md:w-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 
                                                     hover:opacity-90 transition-all duration-200"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-4 w-4 md:h-6 md:w-6 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4 md:h-6 md:w-6" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Features Grid - Hidden on mobile */}
                                <div className="hidden md:grid md:grid-cols-3 gap-6 w-full max-w-4xl px-4">
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <div className="text-blue-500 mb-4">
                                            <LineChart className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">Technical Analysis</h3>
                                        <p className="text-white/70">Get real-time technical indicators and price analysis</p>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <div className="text-purple-500 mb-4">
                                            <BookmarkIcon className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">Market Sentiment</h3>
                                        <p className="text-white/70">Understand market sentiment and trading signals</p>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <div className="text-green-500 mb-4">
                                            <Newspaper className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">News Analysis</h3>
                                        <p className="text-white/70">Stay updated with latest market news and analysis</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Chat Messages
                            <div className="space-y-6">
                                {messages.map((message, index) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex animate-message-in opacity-0",
                                            message.type === 'user' ? "justify-end" : "justify-start"
                                        )}
                                        style={{
                                            animationDelay: `${index * 100}ms`
                                        }}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[95%] md:max-w-[85%] rounded-2xl px-6 py-4 shadow-lg",
                                                message.type === 'user'
                                                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                                    : "bg-white/5 text-white border border-white/10 backdrop-blur-sm"
                                            )}
                                        >
                                            <AnimatedMessage 
                                                content={message.content} 
                                                isNew={index === messages.length - 1 && message.type !== 'user'} 
                                                type={message.type}
                                            />
                                            {message.type === 'data' && message.data && (
                                                <div className="mt-6 space-y-4">
                                                    <StockDataDisplay 
                                                        data={message.data as any}
                                                        analysis={{ intent: message.intent || 'unknown' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Input Area */}
            {messages.length > 0 && (
                <div className="bg-[#0A0A0A]/90 backdrop-blur-lg border-t border-white/10 p-4 md:p-6">
                    <div className="max-w-6xl mx-auto space-y-4">
                        <form onSubmit={handleSubmit} className="flex gap-3">
                            <Input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about a stock..."
                                disabled={isLoading}
                                className="flex-1 text-base rounded-2xl h-14 px-6 bg-white/5 border-white/10 shadow-lg"
                            />
                            <Button 
                                type="submit" 
                                disabled={isLoading || !input.trim()} 
                                className="h-14 w-14 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* News Panel Overlay */}
            {showNews && currentTicker && (
                <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-[#0A0A0A] border-l border-white/10 z-50 overflow-hidden">
                    <div className="sticky top-0 p-3 md:p-4 border-b border-border flex justify-between items-center bg-[#0A0A0A]">
                        <h2 className="font-semibold text-sm md:text-base">News for {currentTicker}</h2>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 md:h-10 md:w-10" 
                            onClick={() => setShowNews(false)}
                        >
                            <X className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    </div>
                    <div className="p-3 md:p-4 overflow-y-auto h-[calc(100vh-48px)] md:h-[calc(100vh-65px)]">
                        <NewsPanel ticker={currentTicker} />
                    </div>
                </div>
            )}
            
            <SignupModal 
                isOpen={showSignupModal} 
                onClose={() => setShowSignupModal(false)} 
                message={getSignupModalContent()} 
            />
        </div>
        </PageTemplate>
    );
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

// Export a wrapped version of the component
export default function StockGPT() {
    return <StockGPTContent />;
}
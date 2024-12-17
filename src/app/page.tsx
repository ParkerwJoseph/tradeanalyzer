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
                theme: 'dark',
                style: '1',
                toolbar_bg: '#1E222D',
                backgroundColor: "#0F0F10",
                gridColor: "#1E222D",
                enable_publishing: false,
                allow_symbol_change: true,
                container_id: containerId,
                studies: [
                    "MASimple@tv-basicstudies",
                    "MACD@tv-basicstudies",
                    "RSI@tv-basicstudies"
                ],
                loading_screen: { backgroundColor: "#0F0F10" },
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
  const sortedCalls = data.options?.unusualStrikes?.calls?.sort((a: OptionStrike, b: OptionStrike) => b.volume - a.volume) || [];
  const sortedPuts = data.options?.unusualStrikes?.puts?.sort((a: OptionStrike, b: OptionStrike) => b.volume - a.volume) || [];

  return (
    <div className="font-mono whitespace-pre-wrap text-sm space-y-4">
      <div className="text-yellow-400 font-bold">Analysis Results:</div>

      <div>
        <div className="text-blue-400 font-bold">{data.ticker}:</div>
        <div>Price: ${data.price.current.toFixed(2)}</div>
        <div>Change: {data.changes.daily}</div>
      </div>

      {data.technicalLevels && (
        <div>
          <div className="text-yellow-400">Technical Levels:</div>
          <div>50-Day MA: ${data.technicalLevels.fiftyDayMA?.toFixed(2) || 'N/A'}</div>
          <div>200-Day MA: ${data.technicalLevels.twoHundredDayMA?.toFixed(2) || 'N/A'}</div>
          <div>Support: ${data.technicalLevels.support?.toFixed(2) || 'N/A'}</div>
          <div>Resistance: ${data.technicalLevels.resistance?.toFixed(2) || 'N/A'}</div>
        </div>
      )}

      {data.technicals && (
        <div>
          <div className="text-yellow-400">Technical Indicators:</div>
          <div>RSI: {data.technicals.rsi?.toFixed(2) || 'N/A'}</div>
          <div>MACD: {data.technicals.macd?.macd?.toFixed(2) || 'N/A'}</div>
          <div>Signal: {data.technicals.macd?.signal?.toFixed(2) || 'N/A'}</div>
        </div>
      )}

      {data.options && (
        <>
          <div>
            <div className="text-yellow-400">Options Overview:</div>
            <div>Put/Call Ratio: {data.options.putCallRatio?.toFixed(2) || 'N/A'}</div>
            <div>Total Call Volume: {data.options.callVolume?.toLocaleString() || 'N/A'}</div>
            <div>Total Put Volume: {data.options.putVolume?.toLocaleString() || 'N/A'}</div>
          </div>

          {sortedCalls.length > 0 && (
            <div>
              <div className="text-yellow-400">Unusual Call Activity:</div>
              {sortedCalls.map((call: OptionStrike, idx: number) => (
                <div key={idx}>
                  Strike: ${call.strike}, Volume: {call.volume.toLocaleString()}, OI: {call.openInterest.toLocaleString()}, IV: {(call.impliedVolatility * 100).toFixed(1)}%, % From Price: {call.percentFromPrice.toFixed(2)}%
                </div>
              ))}
            </div>
          )}

          {sortedPuts.length > 0 && (
            <div>
              <div className="text-yellow-400">Unusual Put Activity:</div>
              {sortedPuts.map((put: OptionStrike, idx: number) => (
                <div key={idx}>
                  Strike: ${put.strike}, Volume: {put.volume.toLocaleString()}, OI: {put.openInterest.toLocaleString()}, IV: {(put.impliedVolatility * 100).toFixed(1)}%, % From Price: {put.percentFromPrice.toFixed(2)}%
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="text-xs text-gray-400 mt-4 border-t border-gray-700 pt-4">
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
const ScrollingQuestions = ({ onQuestionClick }: { onQuestionClick: (question: string) => void }) => {
  return (
    <div className="relative w-full overflow-hidden py-4 before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-20 before:bg-gradient-to-r before:from-background before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-20 after:bg-gradient-to-l after:from-background after:to-transparent">
      <div className="animate-scroll flex gap-4 whitespace-nowrap">
        {[...SAMPLE_QUESTIONS, ...SAMPLE_QUESTIONS].map((question, index) => (
          <button
            key={`${question}-${index}`}
            onClick={() => onQuestionClick(question)}
            className="inline-flex px-4 py-2 rounded-full border border-white/10 bg-white/5 
                     hover:bg-white/10 transition-colors duration-200 text-sm text-white/70 
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
        question: input
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

    return response.data;
  } catch (error) {
    console.error('AI Query Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    throw new Error(`Failed to analyze question: ${errorMessage}`);
  }
};

// Add helper function to extract tickers from text
const extractTickersFromText = (text: string): string[] => {
  const tickerPatterns = [
    /\$([A-Za-z]{1,5})\b/g,                   // $TICKER format
    /\b([A-Za-z]{1,5}):([A-Za-z]+)\b/g,       // TICKER:EXCHANGE format
    /\b(?:of|for|in|about)\s+([A-Za-z]{1,5})\b/gi,  // Common phrases
  ];

  const tickers = new Set<string>();
  
  tickerPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        tickers.add(match[1].toUpperCase());
      }
    }
  });

  return Array.from(tickers);
};

// Update the getQuestionAnalysis function with better error handling
const getQuestionAnalysis = async (input: string) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        messages: [{
          role: "user",
          content: `Analyze this question about stocks: "${input}"
            Return a JSON object with:
            1. intent: one of ["sentiment", "technical", "comparison", "volatility", "support_resistance", "dividend", "price_movement", "valuation", "options"]
            2. tickers: array of stock symbols mentioned
            3. timeframe: one of ["intraday", "short_term", "medium_term", "long_term"]
            4. dataPoints: array of specific metrics requested
            5. analysisDepth: one of ["basic", "detailed", "comprehensive"]`
        }],
        model: "gpt-4-turbo-preview",
        temperature: 0.3,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Analysis Error:', error);
    throw new Error('Failed to analyze question structure');
  }
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

    // Update handleSubmit function
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        
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

    return (
    <PageTemplate title="" description=''>
        <div className="flex flex-col h-full fixed inset-0 pt-14 bg-background">
            {/* Messages Area - Only this should scroll */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <div className="p-4 md:p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {messages.length === 0 ? (
                            <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center px-4">
                                {/* Title Section */}
                                <div className="mb-12">
                                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
                                        StocX
                                    </h1>
                                    <p className="text-xl text-white/70">
                                        Powered by AI market analysis
                                    </p>
                                </div>

                                {/* Scrolling Pills */}
                                <div className="w-full max-w-3xl mb-8 overflow-hidden relative">
                                    <div className="absolute left-0 w-20 h-full bg-gradient-to-r from-background to-transparent z-10" />
                                    <div className="absolute right-0 w-20 h-full bg-gradient-to-l from-background to-transparent z-10" />
                                    
                                    {/* First set of scrolling items */}
                                    <div className="flex gap-2 animate-scroll-x">
                                        {[...EXAMPLE_PROMPTS.flatMap(section => section.prompts), ...EXAMPLE_PROMPTS.flatMap(section => section.prompts)].map((prompt, index) => (
                                            <button
                                                key={`${index}-first`}
                                                onClick={() => setInput(prompt)}
                                                className="flex-none px-4 py-2 rounded-full bg-white/5 border border-white/10 
                                                                     hover:bg-white/10 transition-colors duration-200 
                                                                     text-white/70 hover:text-white/90 text-sm whitespace-nowrap"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Centered Search Bar */}
                                <div className="w-full max-w-2xl">
                                    <div className="relative">
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ask about any stock... e.g., 'Analyze AAPL'"
                                            className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/50 
                                                                 rounded-2xl h-16 px-6 pr-20 transition-all duration-200 
                                                                 hover:bg-white/10 text-lg"
                                        />
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-2 top-2 h-12 w-12 rounded-xl bg-primary 
                                                                 hover:bg-primary/90 transition-all duration-200"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-6 w-6 animate-spin" />
                                            ) : (
                                                <Send className="h-6 w-6" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Regular messages when chat has content
                            messages.map((message, index) => (
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
                                            "max-w-[95%] md:max-w-[85%] rounded-2xl px-5 py-4 transition-all duration-200 hover:scale-[1.01]",
                                            message.type === 'user'
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-card text-card-foreground border border-white/5"
                                        )}
                                    >
                                        <AnimatedMessage 
                                            content={message.content} 
                                            isNew={index === messages.length - 1 && message.type !== 'user'} 
                                            type={message.type}
                                        />
                                        {message.type === 'data' && message.data && (
                                            <div className="mt-6 space-y-4 bg-background/40 p-5 rounded-xl backdrop-blur-sm border border-white/5 transition-all duration-200 hover:bg-background/50">
                                                <StockDataDisplay 
                                                    data={message.data as any}
                                                    analysis={{ intent: message.intent || 'unknown' }}
                                                />
                                            </div>
                                        )}
                                        {message.type === 'system' && (
                                            <div className="mt-4">
                                                <FeedbackButtons 
                                                    messageId={message.id}
                                                    question={messages[index - 2]?.content || ''} 
                                                    answer={message.content}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Input Area - Fixed at bottom */}
            {messages.length > 0 && (
                <div className="bg-background/80 backdrop-blur-lg border-t border-white/5 p-4 md:p-6">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {currentTicker && (
                            <div className="mb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                <SimilarTickers 
                                    tickers={similarTickers} 
                                    onAnalyze={analyzeStock} 
                                />
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex gap-3">
                            <Input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about a stock..."
                                disabled={isLoading}
                                className="flex-1 text-base rounded-2xl h-14 px-6 bg-white/5 border-white/10"
                            />
                            <Button 
                                type="submit" 
                                disabled={isLoading || !input.trim()} 
                                className="h-14 w-14 rounded-xl"
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
                <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-background border-l border-border z-50">
                    <div className="p-4 border-b border-border flex justify-between items-center">
                        <h2 className="font-semibold">News for {currentTicker}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setShowNews(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="p-4 overflow-y-auto h-[calc(100vh-65px)]">
                        <NewsPanel ticker={currentTicker} />
                    </div>
                </div>
            )}

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
'use client'

import { useState, useEffect, useMemo, createContext, useContext, memo, Suspense } from 'react'
import { Send, X, Moon, Sun, Plus, ChevronLeft, ChevronRight, Loader2, Search, Newspaper, User, Compass, Library, BookmarkIcon, LineChart, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTypewriter } from '@/hooks/useTypewriter'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import axios from 'axios'
import { format } from 'date-fns'
import PageTemplate from '@/components/layout/PageTemplate'
import { useTheme } from "next-themes"
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { trackUserQuestion, logUserActivity, saveConversation, trackTickerSearch} from '@/lib/userStore'
import { ref, get } from 'firebase/database'
import { database } from '@/lib/firebase'

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
const AnimatedMessage = ({ content, isNew = false }: { content: string, isNew: boolean }) => {
  const { displayedText, isTyping } = useTypewriter(content, isNew ? 30 : 0)
  
  return (
    <div className="whitespace-pre-wrap">
      {displayedText}
      {isTyping && <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse"/>}
    </div>
  )
}

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

// Update the StockDataDisplay component
const StockDataDisplay = ({ data, symbol }: { data: StockData; symbol: string }) => {
  const [input, setInput] = useContext(InputContext);
  const chartId = useMemo(() => `chart-${symbol}`, [symbol]); // Create stable ID

  return (
    <div className="space-y-6 mt-4">
      {/* Chart section */}
      <div className="rounded-2xl overflow-hidden bg-[#0F0F10]/40 backdrop-blur-md border border-white/5">
        <MemoizedTradingViewChart 
          symbol={symbol} 
          containerId={chartId}
        />
      </div>

      {/* Scrollable Metrics Container */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-1">
          <MetricCard
            title="Price"
            metrics={[
              { label: "Current", value: safeNumberFormat(data.price.current, '$') },
              { label: "Previous", value: safeNumberFormat(data.price.previousClose, '$') },
              { label: "Range", value: data.price.dayRange 
                ? `$${data.price.dayRange.low.toFixed(2)} - $${data.price.dayRange.high.toFixed(2)}` 
                : 'N/A' 
              },
            ]}
          />
          <MetricCard
            title="Technical"
            metrics={[
              { label: "MA50", value: safeNumberFormat(data.technicalLevels.fiftyDayMA, '$') },
              { label: "MA200", value: safeNumberFormat(data.technicalLevels.twoHundredDayMA, '$') },
              { label: "Support/Res", value: `${safeNumberFormat(data.technicalLevels.support, '$')} / ${safeNumberFormat(data.technicalLevels.resistance, '$')}` },
            ]}
          />
          <MetricCard
            title="Volume"
            metrics={[
              { label: "Current", value: formatNumber(data.tradingData.volume) },
              { label: "Average", value: formatNumber(data.tradingData.avgVolume) },
              { label: "Ratio", value: safeNumberFormat(data.tradingData.volumeRatio) },
            ]}
          />
          <MetricCard
            title="Valuation"
            metrics={[
              { label: "Market Cap", value: formatLargeNumber(data.valuationMetrics.marketCap) },
              { label: "P/E Ratio", value: safeNumberFormat(data.valuationMetrics.peRatio) },
              { label: "Forward P/E", value: safeNumberFormat(data.valuationMetrics.forwardPE) },
            ]}
          />
        </div>
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
Output: analyze GOOGL

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

interface RiskMetrics {
  riskToleranceScore: number
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive'
}

// Wrap the component that uses useSearchParams in a Suspense boundary
const StockGPT = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
    
    </Suspense>
  );
};

export default StockGPT;
'use client'

import React, { useState, useEffect } from 'react';
import PageTemplate from '@/components/layout/PageTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface StockResult {
  symbol: string;
  shortName: string;
  marketCap: number;
  regularMarketPrice: number;
  regularMarketVolume: number;
  forwardPE?: number;
  regularMarketChangePercent: number;
  fullExchangeName: string;
  fiftyDayAverageChangePercent?: number;
  fiftyTwoWeekChangePercent?: number;
  averageDailyVolume3Month: number;
  bid: number;
  ask: number;
  quoteType: string;
}

interface CustomFilter {
  name: string;
  filter: any;
}

interface PredefinedScreen {
  title: string;
  filter?: {
    screenerInput: {
      preferredStockExchanges: string[];
      marketCapFilter: { min: number };
      priceFilter: { min: number };
      volumeFilter: { min: number };
      technicalIndicators?: any;
      fundamentalIndicators?: any;
    };
  };
  description?: string;
  searchFunction?: () => Promise<StockResult[]>;
}

const processScreenerResponse = (data: any): StockResult[] => {
  if (data?.finance?.result?.[0]?.quotes) {
    return data.finance.result[0].quotes
      .filter((quote: any) => (
        quote.symbol &&
        !quote.symbol.includes('-') &&
        quote.regularMarketVolume &&
        quote.regularMarketPrice &&
        quote.marketCap &&
        quote.regularMarketVolume > 750000 &&
        quote.regularMarketPrice >= 10 &&
        quote.regularMarketPrice <= 500 &&
        quote.marketCap >= 2000000000 &&
        Math.abs(quote.regularMarketChangePercent || 0) <= 20 &&
        (quote.fullExchangeName?.includes('NYSE') || quote.fullExchangeName?.includes('NASDAQ')) &&
        quote.quoteType === 'EQUITY'
      ))
      .map((quote: any) => ({
        symbol: quote.symbol,
        shortName: quote.shortName || quote.longName || quote.symbol,
        marketCap: quote.marketCap,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketVolume: quote.regularMarketVolume,
        forwardPE: quote.forwardPE,
        regularMarketChangePercent: quote.regularMarketChangePercent || 0,
        fullExchangeName: quote.fullExchangeName || '',
        fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
        fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,
        averageDailyVolume3Month: quote.averageDailyVolume3Month,
        bid: quote.bid,
        ask: quote.ask,
        quoteType: quote.quoteType
      }));
  }
  return [];
};

const searchUndervaluedLargeCaps = async () => {
  const url = 'https://yahoo-finance166.p.rapidapi.com/api/screener/get-predefined-screener?start=0&count=100&scrIds=undervalued_large_caps';
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
      'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    const quotes = data?.finance?.result[0]?.quotes || [];
    
    return quotes
      .map((quote: any) => ({
        symbol: quote.symbol,
        shortName: quote.shortName || quote.longName || quote.symbol,
        marketCap: quote.marketCap,
        regularMarketPrice: quote.regularMarketPrice || quote.price,
        regularMarketVolume: quote.regularMarketVolume || quote.volume,
        forwardPE: quote.forwardPE,
        regularMarketChangePercent: quote.regularMarketChangePercent || quote.changePercent || 0,
        fullExchangeName: quote.fullExchangeName || quote.exchange || '',
        fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
        fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,
        averageDailyVolume3Month: quote.averageDailyVolume3Month,
        bid: quote.bid,
        ask: quote.ask,
        quoteType: quote.quoteType || 'EQUITY'
      }))
      .sort((a: StockResult, b: StockResult) => b.marketCap - a.marketCap);

  } catch (error) {
    console.error('Error fetching undervalued large caps:', error);
    return [];
  }
};

const searchAggressiveSmallCaps = async () => {
  try {
    const url = 'https://yahoo-finance166.p.rapidapi.com/api/screener/get-predefined-screener?start=0&count=100&scrIds=aggressive_small_caps';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
        'x-rapidapi-host': 'yahoo-finance166.p.rapidapi.com'
      }
    });
    
    const data = await response.json();
    const quotes = data?.finance?.result[0]?.quotes || [];
    
    return quotes
      .map((quote: any) => ({
        symbol: quote.symbol,
        shortName: quote.shortName || quote.longName || quote.symbol,
        marketCap: quote.marketCap,
        regularMarketPrice: quote.regularMarketPrice || quote.price,
        regularMarketVolume: quote.regularMarketVolume || quote.volume,
        forwardPE: quote.forwardPE,
        regularMarketChangePercent: quote.regularMarketChangePercent || quote.changePercent || 0,
        fullExchangeName: quote.fullExchangeName || quote.exchange || '',
        fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
        fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,
        averageDailyVolume3Month: quote.averageDailyVolume3Month,
        bid: quote.bid,
        ask: quote.ask,
        quoteType: quote.quoteType || 'EQUITY'
      }))
      .sort((a: StockResult, b: StockResult) => b.marketCap - a.marketCap);
  } catch (error) {
    console.error('Error fetching aggressive small caps:', error);
    return [];
  }
};

const predefinedScreens: Record<string, PredefinedScreen> = {
  '50MA': {
    title: '50MA Support',
    filter: {
      screenerInput: {
        preferredStockExchanges: ['NYSE', 'NASDAQ'],
        marketCapFilter: { min: 1000000000 },
        priceFilter: { min: 5 },
        volumeFilter: { min: 500000 },
        technicalIndicators: {
          fiftyDayMovingAverageChange: {
            min: -2,
            max: 2
          }
        }
      }
    }
  },
  'undervalued': {
    title: 'Undervalued Stocks',
    filter: {
      screenerInput: {
        preferredStockExchanges: ['NYSE', 'NASDAQ'],
        marketCapFilter: { min: 1000000000 },
        priceFilter: { min: 5 },
        volumeFilter: { min: 500000 },
        fundamentalIndicators: {
          forwardPE: { max: 15 }
        }
      }
    }
  },
  'highRS': {
    title: 'High RS Rating',
    filter: {
      screenerInput: {
        preferredStockExchanges: ['NYSE', 'NASDAQ'],
        marketCapFilter: { min: 1000000000 },
        priceFilter: { min: 5 },
        volumeFilter: { min: 500000 },
        technicalIndicators: {
          fiftyTwoWeekHighChange: { min: 30 }
        }
      }
    }
  },
  'mostActive': {
    title: 'Most Active',
    filter: {
      screenerInput: {
        preferredStockExchanges: ['NYSE', 'NASDAQ'],
        marketCapFilter: { min: 1000000000 },
        priceFilter: { min: 5 },
        volumeFilter: { min: 500000 }
      }
    }
  },
  'undervaluedLargeCaps': {
    title: "Undervalued Large Caps",
    description: "Large cap stocks that are potentially undervalued, ordered by volume",
    searchFunction: searchUndervaluedLargeCaps
  },
  'aggressiveSmallCaps': {
    title: "Aggressive Small Caps",
    description: "Small cap stocks with aggressive growth potential",
    searchFunction: searchAggressiveSmallCaps
  }
};

const StockCard = ({ stock }: { stock: StockResult }) => {
  const router = useRouter();
  
  const handleAddToWatchlist = async () => {
    try {
      const stockData = {
        symbol: stock.symbol,
        price: stock.regularMarketPrice,
        change: stock.regularMarketChangePercent,
        volume: stock.regularMarketVolume,
        companyName: stock.shortName
      };
      
      // Get existing watchlist
      const existingWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
      
      // Check if stock already exists
      if (!existingWatchlist.some((item: any) => item.symbol === stock.symbol)) {
        // Add new stock
        const updatedWatchlist = [...existingWatchlist, stockData];
        localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  };

  const handleAskAI = () => {
    // Store the initial message in localStorage
    const initialMessage = `What do you think about ${stock.symbol}`;
    localStorage.setItem('pendingStockQuery', initialMessage);
    
    // Navigate to the stock-gpt page
    router.push('/components/stock-gpt');
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg">{stock.symbol}</h3>
            <p className="text-sm text-gray-600">{stock.shortName}</p>
            <p className="text-xs text-gray-500">{stock.fullExchangeName}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">${stock.regularMarketPrice?.toFixed(2) ?? 'N/A'}</p>
            <p className={`text-sm ${stock.regularMarketChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stock.regularMarketChangePercent?.toFixed(2) ?? 'N/A'}%
            </p>
          </div>
        </div>
        
        {/* Stock metrics */}
        <div className="mt-2 text-sm text-gray-600 grid gap-1">
          <p>Volume: {stock.regularMarketVolume?.toLocaleString() ?? 'N/A'}</p>
          {stock.averageDailyVolume3Month && (
            <p>3M Avg Volume: {stock.averageDailyVolume3Month.toLocaleString()}</p>
          )}
          <p>Market Cap: ${(stock.marketCap / 1e9).toFixed(2)}B</p>
          {stock.forwardPE && <p>Forward P/E: {stock.forwardPE.toFixed(2)}</p>}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddToWatchlist}
            className="flex-1"
          >
            Add to Watchlist
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleAskAI}
            className="flex-1"
          >
            Ask AI
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CustomFilterForm = ({ onSave }: { onSave: (filter: CustomFilter) => void }) => {
  const [filterName, setFilterName] = useState('');
  const [indicator, setIndicator] = useState('technicalIndicators');
  const [metric, setMetric] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filter = {
      name: filterName,
      filter: {
        screenerInput: {
          preferredStockExchanges: ['NYSE', 'NASDAQ'],
          marketCapFilter: { min: 1000000000 },
          priceFilter: { min: 5 },
          volumeFilter: { min: 500000 },
          [indicator]: {
            [metric]: {
              ...(minValue && { min: parseFloat(minValue) }),
              ...(maxValue && { max: parseFloat(maxValue) })
            }
          }
        }
      }
    };
    
    onSave(filter);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="filterName">Filter Name</Label>
        <Input 
          id="filterName" 
          value={filterName} 
          onChange={(e) => setFilterName(e.target.value)}
          placeholder="My Custom Filter"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="indicator">Indicator Type</Label>
        <select 
          id="indicator"
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="technicalIndicators">Technical</option>
          <option value="fundamentalIndicators">Fundamental</option>
        </select>
      </div>

      <div>
        <Label htmlFor="metric">Metric</Label>
        <Input 
          id="metric" 
          value={metric} 
          onChange={(e) => setMetric(e.target.value)}
          placeholder="e.g., priceToBook, fiftyDayMA"
          required
        />
      </div>

      <div>
        <Label htmlFor="minValue">Minimum Value</Label>
        <Input 
          id="minValue" 
          type="number" 
          value={minValue} 
          onChange={(e) => setMinValue(e.target.value)}
          placeholder="Min value (optional)"
        />
      </div>

      <div>
        <Label htmlFor="maxValue">Maximum Value</Label>
        <Input 
          id="maxValue" 
          type="number" 
          value={maxValue} 
          onChange={(e) => setMaxValue(e.target.value)}
          placeholder="Max value (optional)"
        />
      </div>

      <Button type="submit" className="w-full">Save Filter</Button>
    </form>
  );
};

export default function DiscoverPage() {
  const [results, setResults] = useState<StockResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [selectedScreen, setSelectedScreen] = useState<string>('');

  const search50MA = async () => {
    setActiveFilter('50MA');
    setResults([]);
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://yahoo-finance166.p.rapidapi.com/api/screener/list',
        {
          operator: 'and',
          operands: [
            {
              operator: 'or',
              operands: [{ operator: 'EQ', operands: ['region', 'us'] }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'BTWN', 
                operands: ['fiftyDayMovingAverageChangePercent', -3, 3]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['averageDailyVolume3Month', 750000]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['marketCap', 2000000000]
              }]
            }
          ]
        },
        {
          headers: {
            'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
            'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com',
            'Content-Type': 'application/json'
          }
        }
      );

      processResponse(response);
    } catch (error: any) {
      handleError(error);
    }
  };

  const searchUndervalued = async () => {
    setActiveFilter('undervalued');
    setResults([]);
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://yahoo-finance166.p.rapidapi.com/api/screener/list',
        {
          operator: 'and',
          operands: [
            {
              operator: 'or',
              operands: [{ operator: 'EQ', operands: ['region', 'us'] }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'LT', 
                operands: ['forwardPE', 15]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['marketCap', 2000000000]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['averageDailyVolume3Month', 750000]
              }]
            }
          ]
        },
        {
          headers: {
            'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
            'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com',
            'Content-Type': 'application/json'
          }
        }
      );

      processResponse(response);
    } catch (error: any) {
      handleError(error);
    }
  };

  const searchHighRS = async () => {
    setActiveFilter('highRS');
    setResults([]);
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://yahoo-finance166.p.rapidapi.com/api/screener/list',
        {
          operator: 'and',
          operands: [
            {
              operator: 'or',
              operands: [{ operator: 'EQ', operands: ['region', 'us'] }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['fiftyTwoWeekChangePercent', 30]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['marketCap', 2000000000]
              }]
            },
            {
              operator: 'or',
              operands: [{ 
                operator: 'GT', 
                operands: ['averageDailyVolume3Month', 750000]
              }]
            }
          ]
        },
        {
          headers: {
            'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
            'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com',
            'Content-Type': 'application/json'
          }
        }
      );

      processResponse(response);
    } catch (error: any) {
      handleError(error);
    }
  };

  const searchMostActive = async () => {
    setActiveFilter('mostActive');
    setResults([]);
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.get(
        'https://yahoo-finance166.p.rapidapi.com/api/screener/get-predefined-screener',
        {
          params: {
            start: '0',
            count: '100',
            scrIds: 'most_actives'
          },
          headers: {
            'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
            'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
          }
        }
      );

      processResponse(response);
    } catch (error: any) {
      handleError(error);
    }
  };

  const processResponse = (response: any) => {
    if (response.data?.finance?.result?.[0]?.quotes) {
      const quotes = response.data.finance.result[0].quotes;
      console.log('All Symbols:', quotes.map((quote: any) => quote.symbol));
      
      const filteredResults = quotes
        .filter((quote: any) => (
          quote.symbol &&
          !quote.symbol.includes('-') &&
          quote.regularMarketVolume &&
          quote.regularMarketPrice &&
          quote.marketCap &&
          quote.regularMarketVolume > 750000 &&
          quote.regularMarketPrice >= 10 &&
          quote.regularMarketPrice <= 500 &&
          quote.marketCap >= 2000000000 &&
          Math.abs(quote.regularMarketChangePercent || 0) <= 20 &&
          (quote.fullExchangeName?.includes('NYSE') || quote.fullExchangeName?.includes('NASDAQ')) &&
          quote.quoteType === 'EQUITY'
        ))
        .map((quote: any) => ({
          symbol: quote.symbol,
          shortName: quote.shortName || quote.longName || quote.symbol,
          marketCap: quote.marketCap,
          regularMarketPrice: quote.regularMarketPrice,
          regularMarketVolume: quote.regularMarketVolume,
          forwardPE: quote.forwardPE,
          regularMarketChangePercent: quote.regularMarketChangePercent || 0,
          fullExchangeName: quote.fullExchangeName || '',
          fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
          fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,
          averageDailyVolume3Month: quote.averageDailyVolume3Month,
          bid: quote.bid,
          ask: quote.ask,
          quoteType: quote.quoteType
        }));

      console.log('Filtered Results:', filteredResults);
      setResults(filteredResults);
    } else {
      setError('No results found');
      setResults([]);
    }
    setIsLoading(false);
  };

  const handleError = (error: any) => {
    const errorMessage = error?.message || 'An unknown error occurred';
    console.error('Screening error:', errorMessage);
    setError(error?.response?.data?.message || errorMessage || 'Failed to fetch results');
    setResults([]);
    setIsLoading(false);
  };

  const handleScreenSelect = async (screen: keyof typeof predefinedScreens) => {
    setSelectedScreen(screen);
    if (predefinedScreens[screen]?.searchFunction) {
      setIsLoading(true);
      try {
        const results = await predefinedScreens[screen].searchFunction();
        setResults(results);
      } catch (error: any) {
        handleError(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <PageTemplate title="" description="">
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Stock Screener</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={search50MA} 
                variant={activeFilter === '50MA' ? 'default' : 'outline'} 
                className="min-w-[120px]"
              >
                50MA Support
              </Button>
              <Button 
                onClick={searchUndervalued} 
                variant={activeFilter === 'undervalued' ? 'default' : 'outline'} 
                className="min-w-[120px]"
              >
                Undervalued Stocks
              </Button>
              <Button 
                onClick={searchHighRS} 
                variant={activeFilter === 'highRS' ? 'default' : 'outline'} 
                className="min-w-[120px]"
              >
                High RS Rating
              </Button>
              <Button 
                onClick={searchMostActive} 
                variant={activeFilter === 'mostActive' ? 'default' : 'outline'} 
                className="min-w-[120px]"
              >
                Most Active
              </Button>
              <Button
                variant={selectedScreen === 'undervaluedLargeCaps' ? 'default' : 'ghost'}
                onClick={() => handleScreenSelect('undervaluedLargeCaps')}
              >
                Undervalued Large Caps
              </Button>
              <Button
                variant={selectedScreen === 'aggressiveSmallCaps' ? 'default' : 'ghost'}
                onClick={() => handleScreenSelect('aggressiveSmallCaps')}
              >
                Aggressive Small Caps
              </Button>
            </div>

            <ScrollArea className="h-[600px] w-full rounded-md border mt-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <p>Loading results...</p>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-40 text-red-500">
                  <p>{error}</p>
                </div>
              ) : results.length > 0 ? (
                <div className="grid gap-4 p-4">
                  {results.map((stock) => (
                    <StockCard key={`${stock.symbol}-${activeFilter}`} stock={stock} />
                  ))}
                </div>
              ) : (
                <div className="flex justify-center items-center h-40">
                  <p>Select a filter to view stocks</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PageTemplate>
  );
}
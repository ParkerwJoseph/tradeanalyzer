'use client'

import React, { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PageLayout from '@/components/layout/PageTemplate'
import { Search, Plus, Trash2, ArrowUpRight, ArrowDownRight, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { debounce } from 'lodash'

interface YahooFinanceResponse {
  quoteSummary: {
    result: [{
      price: {
        regularMarketPrice: {
          raw: number;
          fmt: string;
        };
        regularMarketChangePercent: {
          raw: number;
          fmt: string;
        };
        regularMarketVolume: {
          raw: number;
          fmt: string;
        };
        shortName: string;
        symbol: string;
      };
    }];
    error: null | string;
  };
}

interface SearchResponse {
  count: number;
  quotes: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
  }>;
}

interface Stock {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  companyName: string;
  alertPrice?: number;
}

const WatchlistPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [watchlist, setWatchlist] = useState<Stock[]>([])
  const [searchResults, setSearchResults] = useState<Stock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState('')
  const [showAlertInput, setShowAlertInput] = useState(false)
  const [alertPrice, setAlertPrice] = useState('')
  const [error, setError] = useState('')

  const fetchStockPrice = async (symbol: string): Promise<{
    price: number;
    change: number;
    volume: number;
    companyName: string;
  } | null> => {
    try {
      const url = `https://yahoo-finance166.p.rapidapi.com/api/stock/get-price?region=US&symbol=${symbol}`
      const options = {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
          'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
        }
      }

      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const data: YahooFinanceResponse = await response.json()
      
      if (data.quoteSummary.error || !data.quoteSummary.result?.[0]?.price) {
        throw new Error(data.quoteSummary.error || 'Invalid response')
      }

      const priceData = data.quoteSummary.result[0].price
      return {
        price: priceData.regularMarketPrice.raw,
        change: priceData.regularMarketChangePercent.raw,
        volume: priceData.regularMarketVolume.raw,
        companyName: priceData.shortName
      }
    } catch (error) {
      console.error('Error fetching stock price:', error)
      setError('Failed to fetch stock price')
      return null
    }
  }

  const handleStockSearch = async (symbol: string) => {
    try {
      setError('')
      setIsLoading(true)
      
      const priceData = await fetchStockPrice(symbol)
      if (priceData) {
        setSearchResults([{
          symbol: symbol.toUpperCase(),
          price: priceData.price,
          change: priceData.change,
          volume: priceData.volume,
          companyName: priceData.companyName
        }])
      } else {
        setSearchResults([])
        setError('Stock not found')
      }
    } catch (error) {
      console.error('Error searching:', error)
      setError('Failed to search stock')
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const searchStocks = async (query: string) => {
    try {
      const url = `https://yahoo-finance166.p.rapidapi.com/api/stock/get-price?region=US&symbol=${query}`
      const options = {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
          'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
        }
      }

      const response = await fetch(url, options)
      if (!response.ok) throw new Error('Search failed')
      
      const data: SearchResponse = await response.json()
      return data.quotes || []
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }

  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length < 1) {
        setSearchResults([])
        setIsLoading(false)
        return
      }

      try {
        setError('')
        setIsLoading(true)

        // Get search suggestions
        const searchResults = await searchStocks(term)
        
        // Fetch price data for each result
        const stocksWithData = await Promise.all(
          searchResults.slice(0, 5).map(async (result) => {
            const priceData = await fetchStockPrice(result.symbol)
            if (priceData && priceData.price && priceData.volume && priceData.companyName) {
              return {
                symbol: result.symbol,
                price: priceData.price,
                change: priceData.change,
                volume: priceData.volume,
                companyName: result.shortname || result.longname || priceData.companyName
              }
            }
            return null
          })
        )

        const validResults = stocksWithData.filter((result): result is Stock => 
          result !== null && 
          typeof result.volume === 'number' && 
          typeof result.companyName === 'string'
        )
        
        setSearchResults(validResults)
      } catch (error) {
        console.error('Error searching:', error)
        setError('Failed to search stocks')
        setSearchResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300),
    []
  )

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toUpperCase()
    setSearchTerm(term)
    setSearchResults([]) // Clear previous results
    debouncedSearch(term)
  }

  const handleAddToWatchlist = async (stock: Stock) => {
    if (watchlist.some(item => item.symbol === stock.symbol)) {
      return
    }

    try {
      const priceData = await fetchStockPrice(stock.symbol)
      if (priceData) {
        const newStock: Stock = {
          symbol: stock.symbol,
          price: priceData.price,
          change: priceData.change,
          volume: priceData.volume,
          companyName: priceData.companyName
        }
        setWatchlist(prev => [...prev, newStock])
        setSearchTerm('')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error adding stock:', error)
      setError('Failed to add stock to watchlist')
    }
  }

  const handleRemoveFromWatchlist = (symbol: string) => {
    setWatchlist(prevWatchlist => prevWatchlist.filter(item => item.symbol !== symbol))
  }

  React.useEffect(() => {
    if (watchlist.length === 0) return

    const updatePrices = async () => {
      const updatedWatchlist = await Promise.all(
        watchlist.map(async (stock) => {
          const priceData = await fetchStockPrice(stock.symbol)
          if (priceData) {
            return {
              ...stock,
              price: priceData.price,
              change: priceData.change,
              volume: priceData.volume,
              companyName: priceData.companyName
            }
          }
          return stock
        })
      )
      setWatchlist(updatedWatchlist)
    }

    const interval = setInterval(updatePrices, 60000)
    return () => clearInterval(interval)
  }, [watchlist])

  return (
    <PageLayout title='' description=''>
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Watchlist</h1>
            <p className="text-muted-foreground">Monitor your favorite stocks</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter stock symbol (e.g., AAPL)"
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-10 pr-4 py-2 w-full bg-background border-input"
                />
              </div>
              <Button 
                onClick={() => searchTerm && handleStockSearch(searchTerm)}
                disabled={!searchTerm || isLoading}
                className="flex items-center justify-center px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>
            {(searchResults.length > 0 || isLoading) && (
              <div className="mt-4 transition-all duration-300 ease-in-out">
                <ScrollArea className="h-[200px]">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {searchResults.map(stock => (
                        <li 
                          key={stock.symbol} 
                          className={`flex justify-between items-center p-4 hover:bg-accent rounded-md cursor-pointer transition-colors duration-200 border-b border-input last:border-b-0 ${
                            stock.change >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                          }`}
                          onClick={() => handleAddToWatchlist(stock)}
                        >
                          <div>
                            <div className="font-medium">{stock.symbol}</div>
                            <div className="text-sm text-muted-foreground">{stock.companyName}</div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="font-medium">${stock.price.toFixed(2)}</div>
                              <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                              </div>
                            </div>
                            <Plus className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors duration-200" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-primary mb-4">Your Watchlist</h2>
          {watchlist.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Your watchlist is currently empty. Start by adding some stocks!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {watchlist.map(stock => (
                <Card key={stock.symbol} className="overflow-hidden">
                  <CardHeader className={`${stock.change >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                    <CardTitle className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">{stock.symbol}</div>
                        <div className="text-sm text-muted-foreground">{stock.companyName}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFromWatchlist(stock.symbol)}
                      >
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-semibold">${stock.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Change</span>
                        <span className={`font-semibold flex items-center ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stock.change >= 0 ? <ArrowUpRight className="mr-1 h-4 w-4" /> : <ArrowDownRight className="mr-1 h-4 w-4" />}
                          {Math.abs(stock.change).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Volume</span>
                        <span className="font-semibold">{stock.volume.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center"
                        onClick={() => {
                          setSelectedStock(stock.symbol);
                          setShowAlertInput(true);
                        }}
                      >
                        <Bell className="mr-2 h-4 w-4" /> Set Alert
                      </Button>
                    </div>
                    {showAlertInput && selectedStock === stock.symbol && (
                      <div className="mt-4 flex space-x-2">
                        <Input
                          type="number"
                          placeholder="Alert Price"
                          value={alertPrice}
                          onChange={(e) => setAlertPrice(e.target.value)}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex items-center justify-center"
                          onClick={() => {
                            const updatedWatchlist = watchlist.map((item) =>
                              item.symbol === stock.symbol ? { ...item, alertPrice: parseFloat(alertPrice) } : item
                            );
                            setWatchlist(updatedWatchlist);
                            setShowAlertInput(false);
                            setAlertPrice('');
                          }}
                        >
                          Set
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

export default WatchlistPage
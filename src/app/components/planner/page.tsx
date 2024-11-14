'use client'
import React, { useState } from 'react';
import PageTemplate from "@/components/layout/PageTemplate"

import { Search, Target, TrendingUp, DollarSign, Pencil, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface StockPlan {
  symbol: string;
  currentPrice: number;
  buyTarget: number;
  sellTarget: number;
  recommendedBuy: number;
  recommendedSell: number;
  companyName: string;
  quantity: number;
}

interface EditingPlan extends StockPlan {
  isEditing: boolean;
}

const StockPlanner = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [stockPlans, setStockPlans] = useState<EditingPlan[]>([]);
  const [currentStock, setCurrentStock] = useState<StockPlan | null>(null);
  const [buyTarget, setBuyTarget] = useState('');
  const [sellTarget, setSellTarget] = useState('');
  const [quantity, setQuantity] = useState('');
  const [editValues, setEditValues] = useState({
    buyTarget: '',
    sellTarget: '',
    quantity: ''
  });

  const fetchStockPrice = async (symbol: string) => {
    try {
      const url = `https://yahoo-finance166.p.rapidapi.com/api/stock/get-price?region=US&symbol=${symbol}`;
      const options = {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1',
          'X-RapidAPI-Host': 'yahoo-finance166.p.rapidapi.com'
        }
      };

      const response = await fetch(url, options);
      if (!response.ok) throw new Error('Failed to fetch stock data');

      const data = await response.json();
      const price = data.quoteSummary.result[0].price;
      
      const currentPrice = price.regularMarketPrice.raw;
      const recommendedBuy = currentPrice * 0.97; // 3% lower
      const recommendedSell = currentPrice * 1.20; // 20% higher

      return {
        currentPrice,
        recommendedBuy,
        recommendedSell,
        companyName: price.shortName
      };
    } catch (error) {
      console.error('Error fetching stock:', error);
      throw new Error('Failed to fetch stock data');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) return;

    try {
      setIsLoading(true);
      setError('');

      const stockData = await fetchStockPrice(searchTerm);
      
      const newStock: StockPlan = {
        symbol: searchTerm.toUpperCase(),
        currentPrice: stockData.currentPrice,
        buyTarget: stockData.recommendedBuy,
        sellTarget: stockData.recommendedSell,
        recommendedBuy: stockData.recommendedBuy,
        recommendedSell: stockData.recommendedSell,
        companyName: stockData.companyName,
        quantity: 0
      };

      setCurrentStock(newStock);
      setBuyTarget(stockData.recommendedBuy.toFixed(2));
      setSellTarget(stockData.recommendedSell.toFixed(2));
      setQuantity('');
    } catch (error) {
      setError('Failed to fetch stock data. Please try again.');
      setCurrentStock(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlan = () => {
    if (!currentStock || !quantity) return;

    const newPlan: EditingPlan = {
      ...currentStock,
      buyTarget: Number(buyTarget),
      sellTarget: Number(sellTarget),
      quantity: Number(quantity),
      isEditing: false
    };

    setStockPlans(prev => [...prev, newPlan]);
    setCurrentStock(null);
    setSearchTerm('');
    setBuyTarget('');
    setSellTarget('');
    setQuantity('');
  };

  const handleRemovePlan = (symbol: string) => {
    setStockPlans(prev => prev.filter(plan => plan.symbol !== symbol));
  };

  const startEditing = (plan: EditingPlan) => {
    setStockPlans(prev =>
      prev.map(p => ({
        ...p,
        isEditing: p.symbol === plan.symbol
      }))
    );
    setEditValues({
      buyTarget: plan.buyTarget.toString(),
      sellTarget: plan.sellTarget.toString(),
      quantity: plan.quantity.toString()
    });
  };

  const saveEditing = (plan: EditingPlan) => {
    setStockPlans(prev =>
      prev.map(p => {
        if (p.symbol === plan.symbol) {
          return {
            ...p,
            buyTarget: Number(editValues.buyTarget),
            sellTarget: Number(editValues.sellTarget),
            quantity: Number(editValues.quantity),
            isEditing: false
          };
        }
        return p;
      })
    );
  };

  const cancelEditing = () => {
    setStockPlans(prev =>
      prev.map(p => ({ ...p, isEditing: false }))
    );
  };

  return (
    <PageTemplate title="Settings" description="">
    <div className="container mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Stock Planner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter stock symbol (e.g., AAPL)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={handleSearch}
              disabled={!searchTerm || isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                'Search'
              )}
            </Button>
          </div>

          {error && (
            <div className="p-4 mb-6 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}

          {currentStock && (
            <Card className="mb-6 bg-accent">
              <CardContent className="p-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{currentStock.symbol}</h3>
                    <span className="text-sm text-muted-foreground">{currentStock.companyName}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Current Price</label>
                      <div className="text-lg font-semibold">${currentStock.currentPrice.toFixed(2)}</div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground">Recommended Buy Below</label>
                      <div className="text-lg font-semibold text-green-600">${currentStock.recommendedBuy.toFixed(2)}</div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground">Your Buy Target</label>
                      <Input
                        type="number"
                        value={buyTarget}
                        onChange={(e) => setBuyTarget(e.target.value)}
                        placeholder="Enter buy target"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground">Your Sell Target</label>
                      <Input
                        type="number"
                        value={sellTarget}
                        onChange={(e) => setSellTarget(e.target.value)}
                        placeholder="Enter sell target"
                        className="mt-1"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-sm text-muted-foreground">Quantity</label>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter number of shares"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddPlan}
                    disabled={!buyTarget || !sellTarget || !quantity}
                    className="w-full mt-4"
                  >
                    Add to Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stockPlans.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-8 gap-4 px-4 py-2 bg-accent rounded-lg text-sm font-medium">
                <div>Symbol</div>
                <div>Current</div>
                <div>Buy Target</div>
                <div>Sell Target</div>
                <div>Quantity</div>
                <div>Total Cost</div>
                <div>Profit</div>
                <div>Actions</div>
              </div>
              {stockPlans.map((plan) => (
                <div key={plan.symbol} className="grid grid-cols-8 gap-4 px-4 py-3 bg-card rounded-lg border items-center">
                  <div>
                    <div className="font-medium">{plan.symbol}</div>
                    <div className="text-xs text-muted-foreground">{plan.companyName}</div>
                  </div>
                  <div>${plan.currentPrice.toFixed(2)}</div>
                  <div>
                    {plan.isEditing ? (
                      <Input
                        type="number"
                        value={editValues.buyTarget}
                        onChange={(e) => setEditValues(prev => ({ ...prev, buyTarget: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      <span className="text-green-600">${plan.buyTarget.toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    {plan.isEditing ? (
                      <Input
                        type="number"
                        value={editValues.sellTarget}
                        onChange={(e) => setEditValues(prev => ({ ...prev, sellTarget: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      <span className="text-blue-600">${plan.sellTarget.toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    {plan.isEditing ? (
                      <Input
                        type="number"
                        value={editValues.quantity}
                        onChange={(e) => setEditValues(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      plan.quantity
                    )}
                  </div>
                  <div>${(plan.buyTarget * plan.quantity).toFixed(2)}</div>
                  <div>
                    <div className="text-green-600">
                      ${((plan.sellTarget - plan.buyTarget) * plan.quantity).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({((plan.sellTarget - plan.buyTarget) / plan.buyTarget * 100).toFixed(2)}%)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {plan.isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEditing(plan)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemovePlan(plan.symbol)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PageTemplate>
  );
};

export default StockPlanner;
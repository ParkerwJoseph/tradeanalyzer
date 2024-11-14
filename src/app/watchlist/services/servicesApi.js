// services/stockApi.js

class StockApiService {
    constructor() {
      this.API_KEY = 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1';
      this.API_HOST = 'yahoo-finance166.p.rapidapi.com';
    }
  
    async getStockPrice(symbol) {
      try {
        const url = `https://yahoo-finance166.p.rapidapi.com/api/stock/get-price?region=US&symbol=${symbol}`;
        const options = {
          method: 'GET',
          headers: {
            'x-rapidapi-key': this.API_KEY,
            'x-rapidapi-host': this.API_HOST
          }
        };
  
        const response = await fetch(url, options);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching stock price:', error);
        return null;
      }
    }
  
    // Add method to search multiple symbols at once
    async searchStocks(query) {
      try {
        // You might want to add an API endpoint for searching stocks
        // For now, we'll use a basic symbol match
        const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META'].filter(
          symbol => symbol.toLowerCase().includes(query.toLowerCase())
        );
  
        const results = await Promise.all(
          symbols.map(async (symbol) => {
            const priceData = await this.getStockPrice(symbol);
            return {
              symbol,
              price: priceData?.price || 0,
              change: priceData?.changePercent || 0,
              volume: priceData?.volume || 0
            };
          })
        );
  
        return results;
      } catch (error) {
        console.error('Error searching stocks:', error);
        return [];
      }
    }
  }
  
  export default new StockApiService();
'use client'

import React, { useState, useEffect } from 'react';
import PageTemplate from "@/components/layout/PageTemplate"


interface NewsArticle {
  title: string;
  url: string;
  provider: { displayName: string };
  pubDate: string;
  content: string;
}

interface NewsApiResponse {
  data: {
    stream: NewsArticle[];
  };
  status: string;
}

const StockNews: React.FC = () => {
  const [symbols, setSymbols] = useState<string>('AAPL'); // Default stock symbol
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch stock news
  const fetchStockNews = async (symbol: string) => {
    const url = `https://yahoo-finance166.p.rapidapi.com/api/news/list-by-symbol?s=${symbol}&region=US&snippetCount=500`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': 'ac906a2ed8msh363ece30de55c86p1fb302jsnc0d3dba809e1', // Replace with your actual key
        'x-rapidapi-host': 'yahoo-finance166.p.rapidapi.com',
      },
    };

    try {
      const response = await fetch(url, options);
      const result: NewsApiResponse = await response.json();
      setLoading(false);
      if (result.data && result.data.stream.length > 0) {
        setNewsArticles(result.data.stream);
      } else {
        setError('No news found for the given stock symbols.');
      }
    } catch (error) {
      setLoading(false);
      setError('Error fetching data from Yahoo Finance.');
    }
  };

  // Handle Search Button Click
  const handleSearch = () => {
    if (searchTerm.trim()) {
      setSymbols(searchTerm);  // Set the symbol to the search term entered
    }
  };

  useEffect(() => {
    // Fetch news whenever the symbols change
    if (symbols) {
      setLoading(true);
      setError('');
      fetchStockNews(symbols);
    }
  }, [symbols]); // Re-run when symbols change

  // Render the component
  return (
    <PageTemplate title='' description=''>
    <div className="news-container">
      <h1 className="news-title">Stock News</h1>

      <div className="search-bar">
        <input 
          type="text" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="Enter stock symbol (e.g., AAPL)"
          className="search-input"
        />
        <button onClick={handleSearch} className="search-button">
          Search
        </button>
      </div>

      {loading && <p>Loading news...</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="news-list">
        {newsArticles.map((article, index) => (
          <div key={index} className="news-article">
            <h2 className="article-title">{article.title}</h2>
            <p className="article-source">Source: {article.provider.displayName}</p>
            <p className="article-date">
              Published on: {new Date(article.pubDate).toLocaleString()}
            </p>
            <p className="article-description">
              {article.content || 'No description available.'}
            </p>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-link">
              Read more
            </a>
          </div>
        ))}
      </div>
    </div>
    </PageTemplate>
  );
};

export default StockNews;

import axios from 'axios';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { apiKey, provider } = await request.json();

        switch (provider) {
            case 'finnhub':
                const finnhubResponse = await axios.get(
                    `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`
                );
                return NextResponse.json({ isValid: !finnhubResponse.data.error });

            case 'alphavantage':
                const alphaResponse = await axios.get(
                    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${apiKey}`
                );
                return NextResponse.json({ isValid: !alphaResponse.data['Error Message'] });

            case 'newsapi':
                const newsResponse = await axios.get(
                    `https://newsapi.org/v2/everything?q=AAPL&apiKey=${apiKey}&pageSize=1`
                );
                return NextResponse.json({ isValid: !newsResponse.data.error });

            default:
                return NextResponse.json({ isValid: false });
        }
    } catch (error) {
        return NextResponse.json({ isValid: false });
    }
}
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI with better error handling
const initializeOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OpenAI API key is not configured in environment variables');
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
};

export async function POST(req: Request) {
  try {
    // Initialize OpenAI client
    const openai = initializeOpenAI();
    
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    console.log('Sending request to OpenAI with API key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    
    try {
      // Verify the response is valid JSON
      const parsedContent = JSON.parse(content || '{}');
      
      return NextResponse.json({
        success: true,
        data: parsedContent
      });
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid response format from OpenAI'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    // Provide more detailed error information
    const errorResponse = {
      success: false,
      error: error.message || 'Failed to process request',
      details: error.response?.data || error.cause || 'No additional details'
    };

    return NextResponse.json(
      errorResponse,
      { status: error.status || 500 }
    );
  }
} 
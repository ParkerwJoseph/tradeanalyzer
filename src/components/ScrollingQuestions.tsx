'use client'

import React from 'react'

const EXAMPLE_QUESTIONS = [
  "What's the current market sentiment for AAPL?",
  "Analyze the technical indicators for TSLA",
  "Show me NVDA's price targets",
  "What are the support levels for MSFT?",
  "Explain META's recent performance",
  "Compare AMZN and GOOGL",
  "Show me unusual options activity for AMD",
  "What's causing SPY's movement today?",
  "Analyze the volume pattern for COIN",
  "What are analyst ratings for PLTR?",
  // Duplicate questions to ensure smooth infinite scroll
  "What's the current market sentiment for AAPL?",
  "Analyze the technical indicators for TSLA",
  "Show me NVDA's price targets",
  "What are the support levels for MSFT?",
  "Explain META's recent performance",
  "Compare AMZN and GOOGL",
  "Show me unusual options activity for AMD",
  "What's causing SPY's movement today?",
  "Analyze the volume pattern for COIN",
  "What are analyst ratings for PLTR?"
]

interface ScrollingQuestionsProps {
  onQuestionClick: (question: string) => void;
}

export function ScrollingQuestions({ onQuestionClick }: ScrollingQuestionsProps) {
  return (
    <div className="w-full overflow-hidden py-4 mb-8">
      <div className="relative w-full before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-20 before:bg-gradient-to-r before:from-[#0A0A0A] before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-20 after:bg-gradient-to-l after:from-[#0A0A0A] after:to-transparent">
        <div className="animate-scroll flex gap-4 whitespace-nowrap">
          {EXAMPLE_QUESTIONS.map((question, index) => (
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
    </div>
  )
} 
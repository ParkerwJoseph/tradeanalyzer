import { useState, useEffect } from 'react';

export function useTypewriter(text: string, speed: number = 10) {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        // Reset when text changes
        setDisplayedText('');
        setIsTyping(true);
        let currentIndex = 0;

        const timer = setInterval(() => {
            if (currentIndex < text.length) {
                setDisplayedText(text.substring(0, currentIndex + 1));
                currentIndex++;
            } else {
                setIsTyping(false);
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayedText, isTyping };
} 
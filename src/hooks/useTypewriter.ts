import { useState, useEffect } from 'react';

export function useTypewriter(text: string, speed: number = 20) {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        setDisplayedText('');
        setIsTyping(true);
        let index = 0;

        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText((current) => current + text.charAt(index));
                index++;
            } else {
                setIsTyping(false);
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayedText, isTyping };
} 
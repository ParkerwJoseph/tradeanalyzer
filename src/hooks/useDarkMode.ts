import { useState, useEffect } from 'react';

export function useDarkMode() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Check if user has dark mode preference
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        setIsDark(isDarkMode);
        
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        setIsDark(!isDark);
        if (!isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        }
    };

    return { isDark, toggleDarkMode };
} 
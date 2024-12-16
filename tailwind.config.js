/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        poppins: ['var(--font-poppins)', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#0A0F1E",
        foreground: "#E5E7EB",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#1F2937",
          foreground: "#E5E7EB",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#1F2937",
          foreground: "#9CA3AF",
        },
        accent: {
          DEFAULT: "#4F46E5",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#111827",
          foreground: "#E5E7EB",
        },
        success: {
          DEFAULT: "#059669",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#D97706",
          foreground: "#FFFFFF",
        },
        info: {
          DEFAULT: "#0EA5E9",
          foreground: "#FFFFFF",
        }
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "market-wave": {
          "0%, 100%": {
            transform: "translateY(0) scale(1)",
            opacity: 0.5
          },
          "50%": {
            transform: "translateY(-20px) scale(1.1)",
            opacity: 0.8
          }
        },
        "candlestick": {
          "0%": {
            height: "10px",
            backgroundColor: "rgba(37, 99, 235, 0.2)"
          },
          "50%": {
            height: "40px",
            backgroundColor: "rgba(37, 99, 235, 0.4)"
          },
          "100%": {
            height: "10px",
            backgroundColor: "rgba(37, 99, 235, 0.2)"
          }
        },
        "number-scroll": {
          "0%": {
            transform: "translateY(0)"
          },
          "100%": {
            transform: "translateY(-50%)"
          }
        },
        "sparkle": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: 1
          },
          "50%": {
            transform: "scale(1.5)",
            opacity: 0.5
          }
        },
        "float-up": {
          "0%": {
            transform: "translateY(20px)",
            opacity: 0
          },
          "100%": {
            transform: "translateY(0)",
            opacity: 1
          }
        },
        "pulse-ring": {
          "0%": {
            transform: "scale(0.8)",
            opacity: 0
          },
          "50%": {
            transform: "scale(1)",
            opacity: 0.5
          },
          "100%": {
            transform: "scale(1.2)",
            opacity: 0
          }
        },
        "scroll-x": {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "market-wave": "market-wave 8s ease-in-out infinite",
        "candlestick": "candlestick 4s ease-in-out infinite",
        "number-scroll": "number-scroll 15s linear infinite",
        "sparkle": "sparkle 2s ease-in-out infinite",
        "float-up": "float-up 0.8s ease-out forwards",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "message-in": "float-up 0.5s ease-out forwards",
        'scroll-x': 'scroll-x 30s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'market-pattern': 'url("/market-pattern.svg")',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 
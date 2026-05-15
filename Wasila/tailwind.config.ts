/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core Brand Colors
        primary: {
          DEFAULT: '#6366F1', // Indigo 500
          light: '#818CF8',
          dark: '#4F46E5',
          content: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#10B981', // Emerald 500
          light: '#34D399',
          dark: '#059669',
          content: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#F59E0B', // Amber 500
          light: '#FBBF24',
          dark: '#D97706',
          content: '#FFFFFF',
        },
        // Semantic Colors
        success: '#22C55E', // Green 500
        error: '#EF4444',   // Red 500
        warning: '#F59E0B', // Amber 500
        info: '#3B82F6',    // Blue 500
        // Background and Surface
        background: '#F3F4F6', // Gray 100 - App background
        surface: '#FFFFFF',    // White - Card background
        // Text Colors
        typography: {
          DEFAULT: '#1F2937', // Gray 800 - Main Text
          muted: '#6B7280',   // Gray 500 - Subtitles/Icons
          light: '#9CA3AF',   // Gray 400 - Disabled
        },
        // Borders and Dividers
        border: '#E5E7EB',    // Gray 200
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        'full': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Spline Sans', 'sans-serif'],
        rounded: ['SF Pro Rounded', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}

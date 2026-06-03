/** @type {import('tailwindcss').Config} */
module.exports = {
  // Specify the paths to all of your template files
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Enable class-based dark mode for precise control over the 'True Black' theme
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // NEW: Professional Purple and True Black Palette
        brand: {
          purple: "#6c3bd4",      // Primary accent for buttons and sent bubbles
          "purple-dark": "#5a2fb0", // Hover state for purple
          black: "#0d1117",       // True GitHub-dark background
          "gray-dark": "#111827", // Sidebar and input bar background (gray-900)
          "gray-medium": "#1f2937", // Message bubbles received (gray-800)
          "gray-light": "#374151",  // Borders and dividers (gray-700)
        }
      },
      // Custom shadow for premium elevated effects
      boxShadow: {
        'brand': '0 4px 14px 0 rgba(108, 59, 212, 0.39)',
      }
    },
  },
  plugins: [],
}

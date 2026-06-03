// Import React and ReactDOM for rendering
import React from 'react';
import ReactDOM from 'react-dom/client';
// Import our main App component
import App from './App';
// Import Tailwind CSS styles
import './index.css';

// Check dark mode preference immediately to prevent flash on reload
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Render the App inside the 'root' div in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode helps find potential problems in the app during development
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

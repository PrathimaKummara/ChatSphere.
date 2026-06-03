// Import React routing components
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Import our pages
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

// A simple component to protect the Chat route
// It checks if a token exists in localStorage. If yes, it shows the children (Chat).
// If no, it redirects to the Login page.
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  
  // If either token or userId is missing, force a re-login to get fresh credentials
  if (!token || !userId) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Main App component that handles routing
const App = () => {
  return (
    // BrowserRouter enables client-side routing
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Route for Chat */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all route to redirect unknown paths to the chat page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

// Import React hooks for managing component state and lifecycle effects
import { useState, useEffect } from 'react';
// Import routing hooks to handle navigation and internal links
import { useNavigate, Link } from 'react-router-dom';
// Import axios to perform secure HTTP requests to the authentication backend
import axios from 'axios';
// Import loader icon for loading states
import { Loader2 } from 'lucide-react';
import api from '../utils/api';
import { initE2EE } from '../utils/encryption';

// Login component handles user sign-in and session initialization
const Login = () => {
  // State to store the user's email input
  const [email, setEmail] = useState('');
  // State to store the user's password input
  const [password, setPassword] = useState('');
  // State to handle and display authentication error messages
  const [error, setError] = useState('');
  // State to track if dark mode is currently active
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Forgot Password & Loading States
  const [view, setView] = useState('login'); // 'login', 'forgot-email', 'forgot-otp'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Hook to programmatically navigate between routes
  const navigate = useNavigate();

  // Effect hook to check and apply the user's preferred theme on initial component mount
  useEffect(() => {
    // Read the theme preference from localStorage
    if (localStorage.getItem('theme') === 'dark') {
      // Apply dark class to the document root for Tailwind support
      document.documentElement.classList.add('dark');
      // Sync internal state with the visual theme
      setIsDarkMode(true);
    } else {
      // Remove dark class for light mode
      document.documentElement.classList.remove('dark');
      // Update state to light mode
      setIsDarkMode(false);
    }
  }, []);

  // Handle the submission of the login form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('userId', response.data.id);
      localStorage.setItem('profile_pic', response.data.profile_pic || '');
      
      // Initialize E2EE (generate keypair if missing, upload public key)
      await initE2EE(api);
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await axios.post('http://localhost:5000/api/auth/forgot-password', { email: resetEmail });
      setSuccessMessage('An OTP has been sent to your email.');
      setView('forgot-otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/reset-password', {
        email: resetEmail,
        otp: resetOtp,
        newPassword
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('userId', response.data.id);
      localStorage.setItem('profile_pic', response.data.profile_pic || '');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    /* Parent layout container: Full viewport, stacked on mobile, split on desktop */
    <div className="flex flex-col md:flex-row w-screen min-h-screen overflow-hidden bg-[#F7F7FF] dark:bg-[#0f0a3d]">
      
      {/* LEFT COLUMN: Branding — hidden on mobile, shown on desktop */}
      <div 
        className="hidden md:flex w-[40vw] min-h-screen h-screen flex-col justify-center items-center p-[48px] relative overflow-hidden text-center"
        style={{ background: 'linear-gradient(135deg, #1a1240 0%, #27187E 50%, #1a1240 100%)' }}
      >
        {/* Decorative Blurred Visual Elements for a premium glassmorphism feel */}
        {/* Large Persian Blue glow at the top-left */}
        <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-[#27187E] rounded-full pointer-events-none" style={{ opacity: 0.25, filter: 'blur(80px)' }}></div>
        {/* Soft Lavender glow at the bottom-right */}
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] bg-[#6c5fc7] rounded-full pointer-events-none" style={{ opacity: 0.2, filter: 'blur(60px)' }}></div>
        {/* Subtle center glow for depth */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[#27187E] rounded-full pointer-events-none" style={{ opacity: 0.15, filter: 'blur(40px)' }}></div>
        
        {/* Content Wrapper for Branding and Features */}
        <div className="flex flex-col items-center justify-center text-center relative z-10 w-full max-w-md">
          {/* Logo Container styled with Persian Blue and elevation */}
          <div className="w-[72px] h-[72px] bg-[#27187E] rounded-[20px] flex items-center justify-center shadow-2xl mb-8 mx-auto border border-white/10">
            <span className="text-white font-[900] text-[26px] tracking-tight">CS</span>
          </div>
          
          {/* Brand Heading with white high-contrast text */}
          <h1 className="text-[44px] font-[900] text-white tracking-tight leading-none">ChatSphere</h1>
          {/* Tagline with muted white text for readability */}
          <p className="text-[17px] mt-[14px] mb-[44px] text-center font-medium" style={{ color: 'rgba(247,247,255,0.7)' }}>
            Professional communication, simplified.
          </p>

          {/* Feature Points list using high-contrast icons and text */}
          <div className="flex flex-col space-y-[18px] w-full items-center text-center">
            {/* Feature Item 1: Real-time messaging */}
            <div className="flex items-center justify-center group">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 transition-transform group-hover:scale-110" style={{ backgroundColor: 'rgba(39,24,126,0.3)', border: '1px solid rgba(247,247,255,0.2)' }}>
                <svg className="w-4 h-4" style={{ color: '#F7F7FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-[16px] tracking-wide" style={{ color: 'rgba(247,247,255,0.95)' }}>Real-time messaging with zero delay</span>
            </div>
            {/* Feature Item 2: Encryption */}
            <div className="flex items-center justify-center group">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 transition-transform group-hover:scale-110" style={{ backgroundColor: 'rgba(39,24,126,0.3)', border: '1px solid rgba(247,247,255,0.2)' }}>
                <svg className="w-4 h-4" style={{ color: '#F7F7FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-[16px] tracking-wide" style={{ color: 'rgba(247,247,255,0.95)' }}>End-to-end encrypted conversations</span>
            </div>
            {/* Feature Item 3: AI powered */}
            <div className="flex items-center justify-center group">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 transition-transform group-hover:scale-110" style={{ backgroundColor: 'rgba(39,24,126,0.3)', border: '1px solid rgba(247,247,255,0.2)' }}>
                <svg className="w-4 h-4" style={{ color: '#F7F7FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-[16px] tracking-wide" style={{ color: 'rgba(247,247,255,0.95)' }}>AI powered smart replies</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Form — full width on mobile, 60vw on desktop */}
      <div 
        className="flex-1 md:w-[60vw] min-h-screen flex justify-center items-center bg-[#F7F7FF] dark:bg-[#0f0a3d] px-4 py-8"
        style={{
          backgroundImage: `radial-gradient(${isDarkMode ? '#1a1240' : '#c5c3e8'} 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px'
        }}
      >
        {/* Centered Form Container with max width for readability */}
        <div className="w-full max-w-[440px] bg-white/50 dark:bg-[#1a1240]/50 backdrop-blur-xl p-[48px] rounded-[32px] shadow-2xl border border-white dark:border-white/5">
          
          {/* Section Header: Welcome and Subtitle */}
          <div className="mb-[40px]">
            {/* Dark Navy text for headings in light mode, White in dark mode */}
            <h2 className="text-[34px] font-[900] tracking-tight text-[#1a1240] dark:text-white mb-2 leading-tight">
              {view === 'login' ? 'Welcome back' : view === 'forgot-email' ? 'Reset Password' : 'Enter OTP'}
            </h2>
            <p className="text-[15px] text-[#6b7280] dark:text-gray-400 font-medium">
              {view === 'login' && 'Please enter your details to sign in.'}
              {view === 'forgot-email' && 'Enter your registered email to receive an OTP.'}
              {view === 'forgot-otp' && 'Enter the 6-digit code sent to your email.'}
            </p>
          </div>
          
          {/* Visual Error Feedback if authentication fails */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-[14px] rounded-[12px] mb-[24px] text-[14px] font-bold border border-red-100 dark:border-red-800/50 flex items-center animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-[14px] rounded-[12px] mb-[24px] text-[14px] font-bold border border-green-100 dark:border-green-800/50 flex items-center animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}
          
          {view === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-[20px]">
              <div>
                <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                  required
                  placeholder="name@example.com"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-[8px]">
                  <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 uppercase tracking-wider">Password</label>
                  <button type="button" onClick={() => { setView('forgot-email'); setError(''); setSuccessMessage(''); }} className="text-[13px] font-bold text-[#27187E] dark:text-[#c5c3e8] hover:text-[#3d2bad] cursor-pointer border-none bg-transparent">
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                  required
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
              
              <div className="pt-[12px]">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full p-[16px] flex items-center justify-center bg-[#27187E] hover:bg-[#3d2bad] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-white font-[800] tracking-wider rounded-[14px] text-[16px] cursor-pointer border-none shadow-xl shadow-persian-600/20 transition-all duration-200"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {isLoading ? 'Signing In...' : 'Sign In to ChatSphere'}
                </button>
              </div>
            </form>
          )}

          {view === 'forgot-email' && (
            <form onSubmit={handleForgotEmailSubmit} className="space-y-[20px]">
              <div>
                <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">Registered Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                  required
                  placeholder="name@example.com"
                  disabled={isLoading}
                />
              </div>
              
              <div className="pt-[12px]">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full p-[16px] flex items-center justify-center bg-[#27187E] hover:bg-[#3d2bad] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-white font-[800] tracking-wider rounded-[14px] text-[16px] cursor-pointer border-none shadow-xl shadow-persian-600/20 transition-all duration-200"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
              
              <div className="text-center mt-[16px]">
                <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMessage(''); }} className="text-[14px] text-[#6b7280] dark:text-gray-400 hover:text-[#1a1240] dark:hover:text-white font-medium border-none bg-transparent cursor-pointer">
                  &larr; Back to Login
                </button>
              </div>
            </form>
          )}

          {view === 'forgot-otp' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-[20px]">
              <div>
                <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">6-Digit OTP</label>
                <input
                  type="text"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[20px] tracking-[0.5em] text-center font-bold focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                  required
                  maxLength={6}
                  placeholder="------"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                  required
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
              
              <div className="pt-[12px]">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full p-[16px] flex items-center justify-center bg-[#27187E] hover:bg-[#3d2bad] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-white font-[800] tracking-wider rounded-[14px] text-[16px] cursor-pointer border-none shadow-xl shadow-persian-600/20 transition-all duration-200"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
              
              <div className="text-center mt-[16px]">
                <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMessage(''); }} className="text-[14px] text-[#6b7280] dark:text-gray-400 hover:text-[#1a1240] dark:hover:text-white font-medium border-none bg-transparent cursor-pointer">
                  &larr; Back to Login
                </button>
              </div>
            </form>
          )}
          
          {view === 'login' && (
            <div className="text-center mt-[32px]">
              <p className="text-[15px] text-[#6b7280] dark:text-gray-400 font-medium">
                New to ChatSphere?{' '}
                <Link to="/register" className="text-[#27187E] dark:text-[#c5c3e8] hover:text-[#3d2bad] font-bold transition-colors underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Export Login for integration in the App router
export default Login;

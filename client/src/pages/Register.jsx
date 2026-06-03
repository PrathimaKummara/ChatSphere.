// Import React hooks for managing state and side effects
import { useState, useEffect, useRef } from 'react';
// Import routing hooks for navigation and links
import { useNavigate, Link } from 'react-router-dom';
// Import axios for making HTTP requests to the backend
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import api from '../utils/api';
import { initE2EE } from '../utils/encryption';

// Register component handles user onboarding and OTP verification
const Register = () => {
  // State for username input field
  const [username, setUsername] = useState('');
  // State for email input field
  const [email, setEmail] = useState('');
  // State for password input field
  const [password, setPassword] = useState('');
  // State for the 6-digit OTP array
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  
  // State to track the current registration step (1 = Details, 2 = OTP)
  const [step, setStep] = useState(1);
  // State for error message feedback
  const [error, setError] = useState('');
  // State for loading indicators during async operations
  const [isLoading, setIsLoading] = useState(false);
  // State for dark mode status
  const [isDarkMode, setIsDarkMode] = useState(false);
  // State for the OTP resend countdown timer
  const [countdown, setCountdown] = useState(0);
  
  // Ref array for auto-focusing OTP input boxes
  const inputRefs = useRef([]);
  
  // Hook for programmatic navigation
  const navigate = useNavigate();

  // Initialization effect to apply theme preference from localStorage
  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  // Timer effect to manage the OTP resend countdown logic
  useEffect(() => {
    let timer;
    if (countdown > 0 && step === 2) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown, step]);

  // Handle step 1: Validate details and send OTP to the user's email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // API call to trigger OTP email generation
      await axios.post('http://localhost:5000/api/auth/send-otp', { email });
      // Proceed to the verification step
      setStep(2);
      // Initialize 30-second countdown for resending
      setCountdown(30);
      
      // Auto-focus the first OTP input box after the transition
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    } catch (err) {
      // Display error message from server
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manage individual character input in the OTP boxes
  const handleOtpChange = (index, value) => {
    // Only allow numeric input for OTP
    if (isNaN(value)) return;

    const newOtpArray = [...otpArray];
    // Special handling for copy-pasted OTP codes
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) {
          newOtpArray[index + i] = pastedData[i];
        }
      }
      setOtpArray(newOtpArray);
      // Focus the appropriate input after pasting
      const nextIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[nextIndex].focus();
      return;
    }

    // Set the single character in the array
    newOtpArray[index] = value;
    setOtpArray(newOtpArray);

    // Auto-focus the next input box if a digit was entered
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle backspace logic to move focus to the previous input
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otpArray[index] === '' && index > 0) {
        inputRefs.current[index - 1].focus();
        const newOtpArray = [...otpArray];
        // Clear the previous character when going back
        newOtpArray[index - 1] = '';
        setOtpArray(newOtpArray);
      }
    }
  };

  // Step 2: Finalize registration by verifying the OTP
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    // Join the array into a single 6-digit string
    const finalOtp = otpArray.join('');
    if (finalOtp.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // API call to verify OTP and create the user record
      const response = await axios.post('http://localhost:5000/api/auth/verify-otp', {
        username,
        email,
        password,
        otp: finalOtp
      });
      
      // Store user session data on success
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('userId', response.data.id);
      localStorage.setItem('profile_pic', response.data.profile_pic || '');
      
      // Initialize E2EE (generate keypair if missing, upload public key)
      await initE2EE(api);
      
      // Redirect to the home chat dashboard
      navigate('/');
    } catch (err) {
      // Handle invalid OTP or database errors
      setError(err.response?.data?.message || 'Invalid OTP or registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    /* Parent container: Full screen layout with split view */
    <div className="flex flex-row w-screen h-screen overflow-hidden bg-[#F7F7FF] dark:bg-[#0f0a3d]">
      
      {/* LEFT COLUMN: Branding and Marketing with Persian Blue Gradient */}
      <div 
        className="w-[40vw] min-h-screen h-screen flex flex-col justify-center items-center p-[48px] relative overflow-hidden text-center"
        /* Modern linear gradient using the Persian Blue palette */
        style={{ background: 'linear-gradient(135deg, #1a1240 0%, #27187E 50%, #1a1240 100%)' }}
      >
        {/* Decorative Glassmorphism Blurred Glows */}
        {/* Large Top Persian Blue glow */}
        <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-[#27187E] rounded-full pointer-events-none" style={{ opacity: 0.25, filter: 'blur(80px)' }}></div>
        {/* Bottom Lavender glow */}
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] bg-[#6c5fc7] rounded-full pointer-events-none" style={{ opacity: 0.2, filter: 'blur(60px)' }}></div>
        {/* Central Persian Blue glow */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[#27187E] rounded-full pointer-events-none" style={{ opacity: 0.15, filter: 'blur(40px)' }}></div>
        
        {/* Branding Content Wrapper */}
        <div className="flex flex-col items-center justify-center text-center relative z-10 w-full max-w-md">
          {/* Persian Blue Logo with heavy shadow and rounded corners */}
          <div className="w-[72px] h-[72px] bg-[#27187E] rounded-[20px] flex items-center justify-center shadow-2xl mb-8 mx-auto border border-white/10">
            <span className="text-white font-[900] text-[26px] tracking-tight">CS</span>
          </div>
          
          {/* Product Name Heading */}
          <h1 className="text-[44px] font-[900] text-white tracking-tight leading-none">ChatSphere</h1>
          {/* Subheading describing the product's core value */}
          <p className="text-[17px] mt-[14px] mb-[44px] text-center font-medium" style={{ color: 'rgba(247,247,255,0.7)' }}>
            Professional communication, simplified.
          </p>

          {/* List of high-value features with Persian Blue themed icons */}
          <div className="flex flex-col space-y-[18px] w-full items-center text-center">
            {/* Feature 1: Real-time messaging */}
            <div className="flex items-center justify-center group">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 transition-transform group-hover:scale-110" style={{ backgroundColor: 'rgba(39,24,126,0.3)', border: '1px solid rgba(247,247,255,0.2)' }}>
                <svg className="w-4 h-4" style={{ color: '#F7F7FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-[16px] tracking-wide" style={{ color: 'rgba(247,247,255,0.95)' }}>Real-time messaging with zero delay</span>
            </div>
            {/* Feature 2: Encryption */}
            <div className="flex items-center justify-center group">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 transition-transform group-hover:scale-110" style={{ backgroundColor: 'rgba(39,24,126,0.3)', border: '1px solid rgba(247,247,255,0.2)' }}>
                <svg className="w-4 h-4" style={{ color: '#F7F7FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-[16px] tracking-wide" style={{ color: 'rgba(247,247,255,0.95)' }}>End-to-end encrypted conversations</span>
            </div>
            {/* Feature 3: Smart replies */}
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

      {/* RIGHT COLUMN: Interactive Form Side with Ghost White background */}
      <div 
        className="w-[60vw] min-h-screen h-screen flex justify-center items-center bg-[#F7F7FF] dark:bg-[#0f0a3d]"
        /* Subtle radial lavender dot pattern for texture */
        style={{
          backgroundImage: `radial-gradient(${isDarkMode ? '#1a1240' : '#c5c3e8'} 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px'
        }}
      >
        {/* Form Content Container with premium glass effect */}
        <div className="w-full max-w-[460px] bg-white/50 dark:bg-[#1a1240]/50 backdrop-blur-xl p-[48px] rounded-[32px] shadow-2xl border border-white dark:border-white/5">
          
          {/* Error Display Box (Animated) */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-[14px] rounded-[12px] mb-[24px] text-[14px] font-bold border border-red-100 dark:border-red-800/50 flex items-center animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          {/* STEP 1: Capture Registration Details */}
          {step === 1 && (
            <>
              <div className="mb-[40px]">
                {/* Heading in Navy (light) or White (dark) */}
                <h2 className="text-[34px] font-[900] tracking-tight text-[#1a1240] dark:text-white mb-2 leading-tight">
                  Create an account
                </h2>
                {/* Supporting description text */}
                <p className="text-[15px] text-[#6b7280] dark:text-gray-400 font-medium">Join ChatSphere and start messaging.</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-[20px]">
                {/* Username Input Group */}
                <div>
                  <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    /* Ghost White themed input with Persian Blue focus */
                    className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                    required
                    placeholder="JohnDoe"
                  />
                </div>
                
                {/* Email Input Group */}
                <div>
                  <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                    required
                    placeholder="john@example.com"
                  />
                </div>
                
                {/* Password Input Group */}
                <div>
                  <label className="block text-[14px] font-bold text-[#1a1240] dark:text-gray-300 mb-[8px] uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-[14px_16px] border border-[#e8e8f0] dark:border-gray-600 rounded-[12px] text-[16px] font-medium focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_4px_rgba(39,24,126,0.1)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all placeholder-[#c5c3e8]"
                    required
                    placeholder="••••••••"
                  />
                </div>
                
                {/* Registration Action Button in Persian Blue */}
                <div className="pt-[12px]">
                  <button
                    type="submit"
                    disabled={isLoading}
                    /* Persian Blue primary styling with interactive scale effect */
                    className="w-full p-[16px] bg-[#27187E] hover:bg-[#3d2bad] active:scale-[0.98] text-white font-[800] tracking-wider rounded-[14px] text-[16px] cursor-pointer border-none shadow-xl shadow-persian-600/20 transition-all duration-200 disabled:opacity-70 disabled:active:scale-100"
                  >
                    {isLoading ? 'Processing...' : 'Generate OTP'}
                  </button>
                </div>
              </form>
              
              {/* Login Redirect Link */}
              <div className="text-center mt-[32px]">
                <p className="text-[15px] text-[#6b7280] dark:text-gray-400 font-medium">
                  Already a member?{' '}
                  <Link to="/login" className="text-[#27187E] dark:text-[#c5c3e8] hover:text-[#3d2bad] font-bold transition-colors underline-offset-4 hover:underline">
                    Sign in here
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* STEP 2: Verify OTP Verification */}
          {step === 2 && (
            <div className="text-center animate-in zoom-in-95 duration-300">
              {/* Mail Icon SVG in Persian Blue */}
              <div className="flex justify-center mb-[24px]">
                <div className="w-20 h-20 bg-[#F7F7FF] dark:bg-[#1f1a4d] rounded-full flex items-center justify-center shadow-inner">
                  <svg className="w-10 h-10 text-[#27187E] dark:text-[#c5c3e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <div className="mb-[40px]">
                {/* OTP Verification Heading */}
                <h2 className="text-[28px] font-[900] text-[#1a1240] dark:text-white mb-3">
                  Verification Code
                </h2>
                {/* Instruction to check the inbox */}
                <p className="text-[15px] text-[#6b7280] dark:text-gray-400 font-medium leading-relaxed">
                  We sent a 6-digit verification code to <br/>
                  <span className="font-bold text-[#27187E] dark:text-white underline underline-offset-4">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyAndRegister}>
                {/* High-visibility 6-box OTP Input using Persian Blue focus states */}
                <div className="flex justify-center space-x-[10px] mb-[40px]">
                  {otpArray.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      /* Individual OTP box styled with Persian Blue focus rings and Ghost White bg */
                      className="w-[52px] h-[64px] text-center text-[28px] font-[800] border-2 border-[#e8e8f0] dark:border-gray-600 rounded-[16px] focus:border-[#27187E] focus:outline-none focus:shadow-[0_0_0_5px_rgba(39,24,126,0.12)] text-[#1a1240] dark:text-white bg-white dark:bg-gray-800 transition-all shadow-sm"
                    />
                  ))}
                </div>
                
                {/* Verify Button in Persian Blue */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full p-[16px] bg-[#27187E] hover:bg-[#3d2bad] active:scale-[0.98] text-white font-[800] tracking-wider rounded-[14px] text-[16px] cursor-pointer border-none shadow-xl transition-all duration-200"
                >
                  {isLoading ? 'Verifying...' : 'Complete Registration'}
                </button>
                
                {/* OTP Re-send and Step-back Controls */}
                <div className="text-center mt-[32px] flex flex-col space-y-5">
                  <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={() => {
                      if (countdown === 0) handleSendOtp();
                    }}
                    /* Dynamic styling for countdown state */
                    className={`text-[14px] font-bold tracking-wide uppercase ${countdown > 0 ? 'text-[#c5c3e8] cursor-not-allowed' : 'text-[#27187E] dark:text-[#c5c3e8] hover:text-[#3d2bad] cursor-pointer'} transition-colors bg-transparent border-none`}
                  >
                    {countdown > 0 ? `Retry in ${countdown}s` : 'Resend code'}
                  </button>
                  
                  {/* Option to go back to step 1 and edit details */}
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtpArray(['', '', '', '', '', '']);
                    }}
                    className="text-[14px] text-[#6b7280] dark:text-gray-400 hover:text-[#1a1240] transition-colors bg-transparent border-none cursor-pointer font-bold uppercase tracking-widest"
                  >
                    Edit details
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Export Register for use in App routes
export default Register;

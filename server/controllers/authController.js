// Import our User helper to interact with MySQL
const User = require('../models/User');
// Import bcryptjs to hash passwords for security
const bcrypt = require('bcryptjs');
// Import jsonwebtoken to create login tokens
const jwt = require('jsonwebtoken');
// Import our new email service
const { sendOTPEmail } = require('../services/emailService');

// In-memory store for OTPs. In production, consider Redis!
// Format: { "user@example.com": { otp: "123456", expiresAt: 1234567890 } }
const otpStore = {};
const resetOtpStore = {};

// Helper function to generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- FEATURE 7: SEND OTP ---
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if email already exists in DB
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Generate a 6 digit OTP
    const otp = generateOTP();
    // Set expiry to 5 minutes from now (Date.now() returns milliseconds)
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Save to our in-memory store
    otpStore[email] = { otp, expiresAt };

    // Send the email using our nodemailer service
    const emailSent = await sendOTPEmail(email, otp);
    
    if (emailSent) {
      // If email succeeded, tell frontend to move to step 2
      res.status(200).json({ message: 'OTP sent successfully' });
    } else {
      // If email failed (e.g. bad credentials), return an error
      res.status(500).json({ message: 'Failed to send OTP email. Please check server logs.' });
    }
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Server error sending OTP' });
  }
};

// --- FEATURE 7: VERIFY OTP & REGISTER ---
exports.verifyOtp = async (req, res) => {
  try {
    // Frontend sends all registration details + the OTP they entered
    const { username, email, password, otp } = req.body;

    // Check if we have an OTP generated for this email
    const storedData = otpStore[email];
    if (!storedData) {
      return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    }

    // Check if OTP matches what the user entered
    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid Verification Code' });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      delete otpStore[email]; // clean up expired OTP
      return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
    }

    // If we reach here, OTP is perfectly valid! 
    // Clean up the used OTP so it can't be used again
    delete otpStore[email];

    // Proceed with actual registration
    // Check username availability
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user to the MySQL database
    const newUserId = await User.createUser(username, email, hashedPassword);

    // Create a JSON Web Token (JWT) so the user is logged in automatically
    const token = jwt.sign(
      { id: newUserId, username: username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send success response with token, username, and id
    res.status(201).json({ 
      message: 'User registered successfully', 
      token,
      username: username,
      id: newUserId,
      profile_pic: null // New users have no pic yet
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
};

// --- FEATURE 8: FORGOT PASSWORD (SEND OTP) ---
exports.forgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (!existingUser) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    resetOtpStore[email] = { otp, expiresAt };

    const emailSent = await sendOTPEmail(email, otp);
    
    if (emailSent) {
      res.status(200).json({ message: 'Password reset OTP sent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to send OTP email.' });
    }
  } catch (error) {
    console.error('Forgot Password OTP Error:', error);
    res.status(500).json({ message: 'Server error sending OTP' });
  }
};

// --- FEATURE 8: RESET PASSWORD ---
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const storedData = resetOtpStore[email];
    if (!storedData) {
      return res.status(400).json({ message: 'No reset request found or it has expired.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (Date.now() > storedData.expiresAt) {
      delete resetOtpStore[email];
      return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
    }

    delete resetOtpStore[email];

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in DB
    await User.updatePassword(email, hashedPassword);

    // Fetch the updated user to create a token and auto-login
    const user = await User.findByEmail(email);
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({ 
      message: 'Password reset successful', 
      token,
      username: user.username,
      id: user.id,
      profile_pic: user.profile_pic
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

// --- PREVIOUS LOGIN FUNCTION ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({ 
      message: 'Login successful', 
      token,
      username: user.username,
      id: user.id,
      profile_pic: user.profile_pic
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// --- OLD REGISTER FUNCTION (Kept for fallback) ---
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findByEmail(email);
    if (existingUser) return res.status(400).json({ message: 'Email is already registered' });
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) return res.status(400).json({ message: 'Username is already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = await User.createUser(username, email, hashedPassword);

    const token = jwt.sign({ id: newUserId, username: username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
};

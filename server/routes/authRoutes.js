// Import the Express framework
const express = require('express');
// Create a new Express router object
const router = express.Router();
// Import the controllers for auth
const authController = require('../controllers/authController');

// Define the POST route for sending the OTP email
router.post('/send-otp', authController.sendOtp);

// Define the POST route for verifying the OTP and creating the account
router.post('/verify-otp', authController.verifyOtp);

// Define the POST route for requesting a password reset OTP
router.post('/forgot-password', authController.forgotPasswordOtp);

// Define the POST route for resetting the password
router.post('/reset-password', authController.resetPassword);

// Define the POST route for user login
router.post('/login', authController.login);

// We keep the old register route for testing purposes or backward compatibility
// but the main flow now goes through send-otp -> verify-otp
router.post('/register', authController.register);

// Export the router
module.exports = router;

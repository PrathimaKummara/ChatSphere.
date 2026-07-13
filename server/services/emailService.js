// server/services/emailService.js
const nodemailer = require('nodemailer');
const dns = require('dns');

// Force DNS resolution to prioritize IPv4 (avoids IPv6 ENETUNREACH errors in IPv4-only cloud hosts like Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Set up the Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS (false) instead of SSL (true)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Avoid potential certificate trust issues on Render
  },
  connectionTimeout: 10000, // 10 seconds connection timeout
  greetingTimeout: 10000,   // 10 seconds SMTP greeting timeout
  socketTimeout: 20000     // 20 seconds socket activity timeout
});

// Function to send the OTP email
const sendOTPEmail = async (toEmail, otp) => {
  try {
    // Define the email contents
    const mailOptions = {
      from: `"ChatSphere" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Your ChatSphere Verification Code',
      text: `Your OTP for ChatSphere registration is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; max-width: 500px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #333;">Welcome to ChatSphere!</h2>
          <p style="color: #555;">Use the verification code below to complete your registration:</p>
          <div style="margin: 30px 0;">
            <span style="background-color: #f4f4f9; color: #7F77DD; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 12px;">This code will expire in 5 minutes.</p>
        </div>
      `
    };

    // Send the email using the transporter
    await transporter.sendMail(mailOptions);
    return true; // Successfully sent
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false; // Failed to send
  }
};

// Export the function for use in the authController
module.exports = { sendOTPEmail };

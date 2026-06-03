// server/services/emailService.js
const nodemailer = require('nodemailer');

// Set up the Gmail SMTP transporter
// It uses the credentials from our .env file to log into your Gmail account
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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

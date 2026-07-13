// server/services/emailService.js
const https = require('https');

// Function to send the OTP email using Brevo HTTP API
const sendOTPEmail = async (toEmail, otp) => {
  try {
    const emailData = JSON.stringify({
      sender: { name: 'ChatSphere', email: process.env.EMAIL_USER || 'prathima.kummara@gmail.com' },
      to: [{ email: toEmail }],
      subject: 'Your ChatSphere Verification Code',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; max-width: 500px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #333;">Welcome to ChatSphere!</h2>
          <p style="color: #555;">Use the verification code below to complete your registration:</p>
          <div style="margin: 30px 0;">
            <span style="background-color: #f4f4f9; color: #7F77DD; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 12px;">This code will expire in 5 minutes.</p>
        </div>
      `
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(emailData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('OTP email sent successfully via Brevo');
            resolve(true);
          } else {
            console.error('Brevo API error:', res.statusCode, data);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('Error sending OTP email:', err);
        resolve(false);
      });

      req.write(emailData);
      req.end();
    });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

// Export the function for use in the authController
module.exports = { sendOTPEmail };

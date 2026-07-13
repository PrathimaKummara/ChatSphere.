const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (toEmail, otp) => {
  try {
    await resend.emails.send({
      from: 'ChatSphere <onboarding@resend.dev>',
      to: toEmail,
      subject: 'Your ChatSphere Verification Code',
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
    });
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

module.exports = { sendOTPEmail };

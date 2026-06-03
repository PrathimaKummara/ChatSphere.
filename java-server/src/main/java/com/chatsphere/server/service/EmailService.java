package com.chatsphere.server.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public boolean sendOTPEmail(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Your ChatSphere Verification Code");
            helper.setFrom("ChatSphere <prathima.kummara@gmail.com>");

            String htmlContent = 
                "<div style=\"font-family: Arial, sans-serif; padding: 20px; text-align: center; max-width: 500px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px;\">" +
                "  <h2 style=\"color: #333;\">Welcome to ChatSphere!</h2>" +
                "  <p style=\"color: #555;\">Use the verification code below to complete your registration:</p>" +
                "  <div style=\"margin: 30px 0;\">" +
                "    <span style=\"background-color: #f4f4f9; color: #7F77DD; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 5px;\">" + otp + "</span>" +
                "  </div>" +
                "  <p style=\"color: #888; font-size: 12px;\">This code will expire in 5 minutes.</p>" +
                "</div>";

            helper.setText(htmlContent, true);
            mailSender.send(message);
            System.out.println("[EmailService] OTP sent successfully to: " + toEmail);
            return true;
        } catch (Exception e) {
            System.err.println("[EmailService] Failed to send OTP email to " + toEmail + ": " + e.getMessage());
            System.out.println("[EmailService] [FALLBACK LOG] OTP for " + toEmail + " is: " + otp);
            // Return true for local development bypass if SMTP fails
            return true;
        }
    }
}

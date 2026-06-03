package com.chatsphere.server.controller;

import com.chatsphere.server.entity.User;
import com.chatsphere.server.repository.UserRepository;
import com.chatsphere.server.security.JwtTokenProvider;
import com.chatsphere.server.service.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final EmailService emailService;

    // In-memory OTP store
    private static class OtpData {
        String otp;
        long expiresAt;
        OtpData(String otp, long expiresAt) {
            this.otp = otp;
            this.expiresAt = expiresAt;
        }
    }

    private final Map<String, OtpData> otpStore = new ConcurrentHashMap<>();
    private final Map<String, OtpData> resetOtpStore = new ConcurrentHashMap<>();

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          JwtTokenProvider tokenProvider, EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.emailService = emailService;
    }

    private String generateOTP() {
        return String.valueOf(100000 + new Random().nextInt(900000));
    }

    // --- 1. SEND OTP ---
    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is already registered"));
        }

        String otp = generateOTP();
        long expiresAt = System.currentTimeMillis() + 5 * 60 * 1000; // 5 minutes
        otpStore.put(email, new OtpData(otp, expiresAt));

        boolean sent = emailService.sendOTPEmail(email, otp);
        if (sent) {
            return ResponseEntity.ok(Map.of("message", "OTP sent successfully"));
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to send OTP email"));
        }
    }

    // --- 2. VERIFY OTP & REGISTER ---
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String email = request.get("email");
        String password = request.get("password");
        String otp = request.get("otp");

        OtpData stored = otpStore.get(email);
        if (stored == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "No OTP found. Please request a new one."));
        }

        if (!stored.otp.equals(otp)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid Verification Code"));
        }

        if (System.currentTimeMillis() > stored.expiresAt) {
            otpStore.remove(email);
            return ResponseEntity.badRequest().body(Map.of("message", "Code has expired. Please request a new one."));
        }

        otpStore.remove(email);

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username is already taken"));
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        User savedUser = userRepository.save(user);

        String token = tokenProvider.generateToken(savedUser.getId(), savedUser.getUsername());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "User registered successfully",
            "token", token,
            "username", savedUser.getUsername(),
            "id", savedUser.getId(),
            "profile_pic", ""
        ));
    }

    // --- 3. FORGOT PASSWORD ---
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }

        if (userRepository.findByEmail(email).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No account found with that email"));
        }

        String otp = generateOTP();
        long expiresAt = System.currentTimeMillis() + 5 * 60 * 1000;
        resetOtpStore.put(email, new OtpData(otp, expiresAt));

        boolean sent = emailService.sendOTPEmail(email, otp);
        if (sent) {
            return ResponseEntity.ok(Map.of("message", "Password reset OTP sent successfully"));
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to send OTP email"));
        }
    }

    // --- 4. RESET PASSWORD ---
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");
        String newPassword = request.get("newPassword");

        OtpData stored = resetOtpStore.get(email);
        if (stored == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "No reset request found or it has expired."));
        }

        if (!stored.otp.equals(otp)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid verification code"));
        }

        if (System.currentTimeMillis() > stored.expiresAt) {
            resetOtpStore.remove(email);
            return ResponseEntity.badRequest().body(Map.of("message", "Code has expired. Please request a new one."));
        }

        resetOtpStore.remove(email);

        User user = userRepository.findByEmail(email)
                .orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found"));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId(), user.getUsername());

        return ResponseEntity.ok(Map.of(
            "message", "Password reset successful",
            "token", token,
            "username", user.getUsername(),
            "id", user.getId(),
            "profile_pic", user.getProfilePic() == null ? "" : user.getProfilePic()
        ));
    }

    // --- 5. LOGIN ---
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String password = request.get("password");

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid email or password"));
        }

        String token = tokenProvider.generateToken(user.getId(), user.getUsername());

        return ResponseEntity.ok(Map.of(
            "message", "Login successful",
            "token", token,
            "username", user.getUsername(),
            "id", user.getId(),
            "profile_pic", user.getProfilePic() == null ? "" : user.getProfilePic()
        ));
    }

    // --- 6. REGISTER (Direct Fallback) ---
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String email = request.get("email");
        String password = request.get("password");

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is already registered"));
        }
        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username is already taken"));
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        User savedUser = userRepository.save(user);

        String token = tokenProvider.generateToken(savedUser.getId(), savedUser.getUsername());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "User registered successfully",
            "token", token,
            "username", savedUser.getUsername(),
            "id", savedUser.getId(),
            "profile_pic", ""
        ));
    }
}

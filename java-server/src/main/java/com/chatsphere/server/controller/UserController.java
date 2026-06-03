package com.chatsphere.server.controller;

import com.chatsphere.server.entity.BlockedUser;
import com.chatsphere.server.entity.Report;
import com.chatsphere.server.entity.User;
import com.chatsphere.server.repository.BlockedUserRepository;
import com.chatsphere.server.repository.ReportRepository;
import com.chatsphere.server.repository.UserRepository;
import com.chatsphere.server.security.JwtAuthenticationFilter.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final ReportRepository reportRepository;

    public UserController(UserRepository userRepository, BlockedUserRepository blockedUserRepository,
                          ReportRepository reportRepository) {
        this.userRepository = userRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.reportRepository = reportRepository;
    }

    private UserPrincipal getAuthenticatedUser() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // --- 1. GET PROFILE ---
    @GetMapping("/profile/{userId}")
    public ResponseEntity<?> getUserProfile(@PathVariable Integer userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found"));
        }
        User user = userOpt.get();
        Map<String, Object> res = new HashMap<>();
        res.put("id", user.getId());
        res.put("username", user.getUsername());
        res.put("email", user.getEmail());
        res.put("is_online", user.getIsOnline());
        res.put("last_seen", user.getLastSeen());
        res.put("profile_pic", user.getProfilePic() == null ? "" : user.getProfilePic());
        res.put("created_at", user.getCreatedAt());
        res.put("about", user.getAbout());
        return ResponseEntity.ok(res);
    }

    // --- 2. GET OWN PROFILE ---
    @GetMapping("/me")
    public ResponseEntity<?> getOwnProfile() {
        Integer userId = getAuthenticatedUser().getId();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found"));
        }
        User user = userOpt.get();
        Map<String, Object> res = new HashMap<>();
        res.put("id", user.getId());
        res.put("username", user.getUsername());
        res.put("email", user.getEmail());
        res.put("profile_pic", user.getProfilePic() == null ? "" : user.getProfilePic());
        res.put("about", user.getAbout());
        return ResponseEntity.ok(res);
    }

    // --- 3. UPDATE DISPLAY NAME ---
    @PutMapping("/update-name")
    public ResponseEntity<?> updateDisplayName(@RequestBody Map<String, String> request) {
        String newName = request.get("newName");
        if (newName == null || newName.trim().length() < 2) {
            return ResponseEntity.badRequest().body(Map.of("message", "Display name must be at least 2 characters long"));
        }

        Integer userId = getAuthenticatedUser().getId();
        User user = userRepository.findById(userId).orElseThrow();
        user.setUsername(newName.trim());
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Display name updated successfully", "username", user.getUsername()));
    }

    // --- 4. UPDATE ABOUT ---
    @PutMapping("/update-about")
    public ResponseEntity<?> updateAbout(@RequestBody Map<String, String> request) {
        String about = request.get("about");
        String safeAbout = (about == null ? "" : about).trim();
        if (safeAbout.length() > 160) {
            safeAbout = safeAbout.substring(0, 160);
        }

        Integer userId = getAuthenticatedUser().getId();
        User user = userRepository.findById(userId).orElseThrow();
        user.setAbout(safeAbout);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "About updated successfully", "about", safeAbout));
    }

    // --- 5. SEARCH USERS ---
    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query) {
        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Search query is required"));
        }

        Integer currentUserId = getAuthenticatedUser().getId();
        List<User> matches = userRepository.findByUsernameContainingIgnoreCase(query);

        // Filter out current user and blocked users
        List<Map<String, Object>> filtered = matches.stream()
            .filter(u -> !u.getId().equals(currentUserId))
            .filter(u -> !blockedUserRepository.existsByBlockerIdAndBlockedId(currentUserId, u.getId()))
            .limit(15)
            .map(u -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", u.getId());
                m.put("username", u.getUsername());
                m.put("email", u.getEmail());
                m.put("profile_pic", u.getProfilePic() == null ? "" : u.getProfilePic());
                return m;
            })
            .collect(Collectors.toList());

        return ResponseEntity.ok(filtered);
    }

    // --- 6. UPDATE PUBLIC KEY ---
    @PutMapping("/public-key")
    public ResponseEntity<?> updatePublicKey(@RequestBody Map<String, String> request) {
        String publicKey = request.get("publicKey");
        if (publicKey == null || publicKey.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Public key is required"));
        }

        Integer userId = getAuthenticatedUser().getId();
        User user = userRepository.findById(userId).orElseThrow();
        user.setPublicKey(publicKey);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Public key updated successfully"));
    }

    // --- 7. GET PUBLIC KEY ---
    @GetMapping("/public-key/{userId}")
    public ResponseEntity<?> getPublicKey(@PathVariable Integer userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty() || userOpt.get().getPublicKey() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Public key not found"));
        }
        return ResponseEntity.ok(Map.of("publicKey", userOpt.get().getPublicKey()));
    }

    // --- 8. BLOCK USER ---
    @PostMapping("/block")
    public ResponseEntity<?> blockUser(@RequestBody Map<String, Object> request) {
        Object blockedUserIdObj = request.get("blockedUserId");
        if (blockedUserIdObj == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "blockedUserId is required"));
        }

        Integer blockerId = getAuthenticatedUser().getId();
        Integer blockedUserId = Integer.valueOf(blockedUserIdObj.toString());

        if (blockerId.equals(blockedUserId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot block yourself"));
        }

        if (!blockedUserRepository.existsByBlockerIdAndBlockedId(blockerId, blockedUserId)) {
            BlockedUser block = new BlockedUser();
            block.setBlockerId(blockerId);
            block.setBlockedId(blockedUserId);
            blockedUserRepository.save(block);
        }

        return ResponseEntity.ok(Map.of("message", "User blocked successfully"));
    }

    // --- 9. REPORT USER ---
    @PostMapping("/report")
    public ResponseEntity<?> reportUser(@RequestBody Map<String, Object> request) {
        Object reportedUserIdObj = request.get("reportedUserId");
        String reason = (String) request.get("reason");

        if (reportedUserIdObj == null || reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "reportedUserId and reason are required"));
        }

        Integer reporterId = getAuthenticatedUser().getId();
        Integer reportedUserId = Integer.valueOf(reportedUserIdObj.toString());

        if (reporterId.equals(reportedUserId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot report yourself"));
        }

        Report report = new Report();
        report.setReporterId(reporterId);
        report.setReportedId(reportedUserId);
        report.setReason(reason);
        reportRepository.save(report);

        return ResponseEntity.ok(Map.of("message", "Report submitted successfully"));
    }

    // --- 10. UPLOAD AVATAR ---
    @PostMapping("/upload-avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("avatar") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file uploaded"));
        }

        try {
            String uploadsPath = new File("../server/uploads/avatars/").getAbsolutePath();
            File destDir = new File(uploadsPath);
            if (!destDir.exists()) {
                destDir.mkdirs();
            }

            String origName = file.getOriginalFilename();
            String extension = origName != null && origName.contains(".") ? origName.substring(origName.lastIndexOf(".")) : ".jpg";
            String newFileName = System.currentTimeMillis() + "_" + java.util.UUID.randomUUID().toString().substring(0, 8) + extension;
            
            Path path = Paths.get(uploadsPath, newFileName);
            Files.write(path, file.getBytes());

            String fileUrl = "/uploads/avatars/" + newFileName;

            Integer userId = getAuthenticatedUser().getId();
            User user = userRepository.findById(userId).orElseThrow();
            user.setProfilePic(fileUrl);
            userRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "Avatar updated successfully", "profile_pic", fileUrl));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error uploading avatar: " + e.getMessage()));
        }
    }
}

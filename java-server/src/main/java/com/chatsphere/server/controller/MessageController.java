package com.chatsphere.server.controller;

import com.chatsphere.server.document.Message;
import com.chatsphere.server.entity.DirectConversation;
import com.chatsphere.server.entity.MessageRequest;
import com.chatsphere.server.entity.User;
import com.chatsphere.server.repository.DirectConversationRepository;
import com.chatsphere.server.repository.MessageRequestRepository;
import com.chatsphere.server.repository.MessageRepository;
import com.chatsphere.server.repository.UserRepository;
import com.chatsphere.server.security.JwtAuthenticationFilter.UserPrincipal;
import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageRepository messageRepository;
    private final DirectConversationRepository directConversationRepository;
    private final MessageRequestRepository messageRequestRepository;
    private final UserRepository userRepository;
    private final SocketIOServer socketServer;

    public MessageController(MessageRepository messageRepository,
                             DirectConversationRepository directConversationRepository,
                             MessageRequestRepository messageRequestRepository,
                             UserRepository userRepository,
                             SocketIOServer socketServer) {
        this.messageRepository = messageRepository;
        this.directConversationRepository = directConversationRepository;
        this.messageRequestRepository = messageRequestRepository;
        this.userRepository = userRepository;
        this.socketServer = socketServer;
    }

    private UserPrincipal getAuthenticatedUser() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // --- 1. GET MESSAGES (Room or DM) ---
    @GetMapping("/{roomId}")
    public ResponseEntity<?> getMessages(@PathVariable String roomId) {
        Integer userId = getAuthenticatedUser().getId();
        boolean isDirect = roomId.startsWith("dm_");
        List<Message> messages;

        if (isDirect) {
            String convId = roomId.replace("dm_", "");
            Optional<DirectConversation> convOpt = directConversationRepository.findById(Integer.parseInt(convId));
            
            Instant clearedAt = null;
            if (convOpt.isPresent()) {
                DirectConversation conv = convOpt.get();
                LocalDateTime dt = conv.getUser1Id().equals(userId) ? conv.getUser1ClearedAt() : conv.getUser2ClearedAt();
                if (dt != null) {
                    clearedAt = dt.atZone(ZoneId.systemDefault()).toInstant();
                }
            }

            if (clearedAt != null) {
                messages = messageRepository.findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(convId, clearedAt);
            } else {
                messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(convId);
            }
        } else {
            messages = messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
        }

        // Limit to last 100 if list is too large
        if (messages.size() > 100) {
            messages = messages.subList(messages.size() - 100, messages.size());
        }

        return ResponseEntity.ok(messages);
    }

    // --- 2. UPLOAD MEDIA ---
    @PostMapping("/upload")
    public ResponseEntity<?> uploadMedia(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file uploaded"));
        }

        try {
            String uploadsPath = new File("../server/uploads/").getAbsolutePath();
            File destDir = new File(uploadsPath);
            if (!destDir.exists()) {
                destDir.mkdirs();
            }

            String origName = file.getOriginalFilename();
            String extension = origName != null && origName.contains(".") ? origName.substring(origName.lastIndexOf(".")) : "";
            String newFileName = System.currentTimeMillis() + "_" + java.util.UUID.randomUUID().toString().substring(0, 8) + extension;
            
            Path path = Paths.get(uploadsPath, newFileName);
            Files.write(path, file.getBytes());

            String fileUrl = "/uploads/" + newFileName;

            return ResponseEntity.ok(Map.of(
                "fileUrl", fileUrl,
                "fileName", origName != null ? origName : newFileName,
                "fileType", file.getContentType() != null ? file.getContentType() : "",
                "size", file.getSize()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error uploading media: " + e.getMessage()));
        }
    }

    // --- 3. GET MEDIA MESSAGES FOR PANEL ---
    @GetMapping("/{conversationId}/media")
    public ResponseEntity<?> getMediaMessages(@PathVariable String conversationId) {
        String cleanId = conversationId.replace("dm_", "");
        String roomId = "dm_" + cleanId;
        Pageable limit = PageRequest.of(0, 50, Sort.by("createdAt").descending());
        
        List<Message> mediaMsgs = messageRepository.findMediaMessages(cleanId, roomId, limit);
        
        List<Map<String, Object>> formatted = mediaMsgs.stream().map(m -> Map.of(
            "fileUrl", m.getFileUrl() == null ? "" : m.getFileUrl(),
            "fileName", m.getFileName() == null ? "" : m.getFileName(),
            "fileType", m.getFileType() == null ? "" : m.getFileType(),
            "createdAt", m.getCreatedAt(),
            "senderId", m.getSenderId()
        )).collect(Collectors.toList());

        return ResponseEntity.ok(formatted);
    }

    // --- 4. TOGGLE REACTION ---
    @PostMapping("/{messageId}/react")
    public ResponseEntity<?> toggleReaction(@PathVariable String messageId, @RequestBody Map<String, String> request) {
        String emoji = request.get("emoji");
        String username = request.get("username");
        Integer userId = getAuthenticatedUser().getId();

        if (emoji == null || emoji.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Emoji is required"));
        }

        Optional<Message> msgOpt = messageRepository.findById(messageId);
        if (msgOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Message not found"));
        }

        Message message = msgOpt.get();
        
        // Find reaction
        Message.Reaction targetReaction = null;
        for (Message.Reaction r : message.getReactions()) {
            if (r.getEmoji().equals(emoji)) {
                targetReaction = r;
                break;
            }
        }

        if (targetReaction != null) {
            // Check if user already reacted
            Message.ReactionUser targetUser = null;
            for (Message.ReactionUser ru : targetReaction.getUsers()) {
                if (ru.getUserId().toString().equals(userId.toString())) {
                    targetUser = ru;
                    break;
                }
            }

            if (targetUser != null) {
                // Remove reaction
                targetReaction.getUsers().remove(targetUser);
                if (targetReaction.getUsers().isEmpty()) {
                    message.getReactions().remove(targetReaction);
                }
            } else {
                // Add user to existing emoji
                targetReaction.getUsers().add(new Message.ReactionUser(userId, username));
            }
        } else {
            // Create new reaction
            Message.Reaction r = new Message.Reaction();
            r.setEmoji(emoji);
            r.getUsers().add(new Message.ReactionUser(userId, username));
            message.getReactions().add(r);
        }

        Message savedMsg = messageRepository.save(message);

        // Emit socket event to the room
        if (socketServer != null) {
            socketServer.getRoomOperations(message.getRoomId()).sendEvent("messageReacted", savedMsg);
        }

        return ResponseEntity.ok(savedMsg);
    }

    // --- 5. CLEAR MESSAGES ---
    @DeleteMapping("/{conversationId}")
    @Transactional
    public ResponseEntity<?> clearMessages(@PathVariable String conversationId) {
        Integer userId = getAuthenticatedUser().getId();
        String cleanId = conversationId.replace("dm_", "");

        Optional<DirectConversation> convOpt = directConversationRepository.findById(Integer.parseInt(cleanId));
        if (convOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Conversation not found"));
        }

        DirectConversation conv = convOpt.get();
        if (conv.getUser1Id().equals(userId)) {
            conv.setUser1ClearedAt(LocalDateTime.now());
        } else {
            conv.setUser2ClearedAt(LocalDateTime.now());
        }

        directConversationRepository.save(conv);

        // Emit clear message event to this user's socket room
        if (socketServer != null) {
            socketServer.getRoomOperations("user_" + userId).sendEvent("chatCleared", Map.of("roomId", conversationId));
        }

        return ResponseEntity.ok(Map.of("message", "Chat cleared successfully"));
    }

    // --- 6. CREATE DIRECT MESSAGE REQUEST ---
    @PostMapping("/request")
    public ResponseEntity<?> createRequest(@RequestBody Map<String, Object> request) {
        Object toUserIdObj = request.get("toUserId");
        if (toUserIdObj == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "toUserId is required"));
        }

        Integer fromUserId = getAuthenticatedUser().getId();
        String fromUsername = getAuthenticatedUser().getUsername();
        Integer toUserId = Integer.valueOf(toUserIdObj.toString());

        if (fromUserId.equals(toUserId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot message yourself"));
        }

        // Check if conversation already exists
        Optional<DirectConversation> existing = directConversationRepository.findConversationBetween(fromUserId, toUserId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("message", "Conversation exists", "conversationId", existing.get().getId()));
        }

        // Check if request already pending
        Optional<MessageRequest> pending = messageRequestRepository.findByFromUserIdAndToUserIdAndStatus(fromUserId, toUserId, "pending");
        if (pending.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Request already sent"));
        }

        MessageRequest req = new MessageRequest();
        req.setFromUserId(fromUserId);
        req.setFromUsername(fromUsername);
        req.setToUserId(toUserId);
        MessageRequest savedReq = messageRequestRepository.save(req);

        if (socketServer != null) {
            socketServer.getRoomOperations("user_" + toUserId).sendEvent("incomingRequest", savedReq);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Message request sent successfully"));
    }

    // --- 7. GET PENDING REQUESTS ---
    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests() {
        Integer userId = getAuthenticatedUser().getId();
        List<MessageRequest> requests = messageRequestRepository.findByToUserIdAndStatus(userId, "pending");
        return ResponseEntity.ok(requests);
    }

    // --- 8. ACCEPT REQUEST ---
    @PutMapping("/request/{id}/accept")
    @Transactional
    public ResponseEntity<?> acceptRequest(@PathVariable Integer id) {
        Integer userId = getAuthenticatedUser().getId();

        Optional<MessageRequest> reqOpt = messageRequestRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Request not found"));
        }

        MessageRequest req = reqOpt.get();
        if (!req.getToUserId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Unauthorized"));
        }

        req.setStatus("accepted");
        messageRequestRepository.save(req);

        Integer user1 = req.getFromUserId();
        Integer user2 = userId;

        Optional<DirectConversation> existing = directConversationRepository.findConversationBetween(user1, user2);
        Integer conversationId;
        if (existing.isPresent()) {
            conversationId = existing.get().getId();
        } else {
            DirectConversation dc = new DirectConversation();
            dc.setUser1Id(user1);
            dc.setUser2Id(user2);
            DirectConversation savedDc = directConversationRepository.save(dc);
            conversationId = savedDc.getId();
        }

        if (socketServer != null) {
            Map<String, Object> payload = Map.of(
                "conversationId", conversationId,
                "requestId", id
            );
            socketServer.getRoomOperations("user_" + user1).sendEvent("requestAccepted", payload);
            socketServer.getRoomOperations("user_" + user2).sendEvent("requestAccepted", payload);
        }

        return ResponseEntity.ok(Map.of(
            "message", "Request accepted",
            "conversation", Map.of(
                "id", conversationId,
                "user1_id", user1,
                "user2_id", user2,
                "otherUsername", req.getFromUsername(),
                "otherUserId", req.getFromUserId()
            )
        ));
    }

    // --- 9. BLOCK REQUEST ---
    @PutMapping("/request/{id}/block")
    public ResponseEntity<?> blockRequest(@PathVariable Integer id) {
        Optional<MessageRequest> reqOpt = messageRequestRepository.findById(id);
        if (reqOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Request not found"));
        }

        MessageRequest req = reqOpt.get();
        req.setStatus("blocked");
        messageRequestRepository.save(req);

        if (socketServer != null) {
            socketServer.getRoomOperations("user_" + req.getToUserId()).sendEvent("requestBlocked", Map.of("requestId", id));
            socketServer.getRoomOperations("user_" + req.getFromUserId()).sendEvent("requestBlocked", Map.of("requestId", id));
        }

        return ResponseEntity.ok(Map.of("message", "User blocked"));
    }

    // --- 10. GET DIRECT CONVERSATIONS ---
    @GetMapping("/direct/conversations")
    public ResponseEntity<?> getDirectConversations() {
        Integer userId = getAuthenticatedUser().getId();

        List<DirectConversation> convs = directConversationRepository.findByUser1IdOrUser2Id(userId, userId);

        List<Map<String, Object>> formatted = convs.stream().map(c -> {
            Integer otherUserId = c.getUser1Id().equals(userId) ? c.getUser2Id() : c.getUser1Id();
            User otherUser = userRepository.findById(otherUserId).orElse(null);
            
            if (otherUser == null) return null;

            Map<String, Object> map = new HashMap<>();
            map.put("conversationId", c.getId());
            map.put("otherUserId", otherUser.getId());
            map.put("name", otherUser.getUsername());
            map.put("profile_pic", otherUser.getProfilePic() == null ? "" : otherUser.getProfilePic());
            map.put("user1_id", c.getUser1Id());
            map.put("user2_id", c.getUser2Id());

            LocalDateTime dt = c.getUser1Id().equals(userId) ? c.getUser1ClearedAt() : c.getUser2ClearedAt();
            Instant clearedAt = dt == null ? null : dt.atZone(ZoneId.systemDefault()).toInstant();

            // Find last message
            Optional<Message> lastMsgOpt;
            String cleanId = String.valueOf(c.getId());
            String roomId = "dm_" + cleanId;
            Pageable oneSortedDesc = PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt"));

            if (clearedAt != null) {
                List<Message> msgs = messageRepository.findFirstByConversationIdOrRoomIdAndCreatedAtGreaterThanOrderByCreatedAtDesc(cleanId, roomId, clearedAt, oneSortedDesc);
                lastMsgOpt = msgs.isEmpty() ? Optional.empty() : Optional.of(msgs.get(0));
            } else {
                List<Message> msgs = messageRepository.findFirstByConversationIdOrRoomIdOrderByCreatedAtDesc(cleanId, roomId, oneSortedDesc);
                lastMsgOpt = msgs.isEmpty() ? Optional.empty() : Optional.of(msgs.get(0));
            }

            if (lastMsgOpt.isPresent()) {
                Message lastMsg = lastMsgOpt.get();
                map.put("lastMessage", Map.of(
                    "content", lastMsg.getContent(),
                    "senderId", lastMsg.getSenderId(),
                    "status", lastMsg.getStatus() == null ? "sent" : lastMsg.getStatus(),
                    "createdAt", lastMsg.getCreatedAt(),
                    "type", lastMsg.getType(),
                    "fileName", lastMsg.getFileName() == null ? "" : lastMsg.getFileName(),
                    "isEncrypted", lastMsg.getIsEncrypted(),
                    "encryptedKey", lastMsg.getEncryptedKey() == null ? "" : lastMsg.getEncryptedKey(),
                    "senderEncryptedKey", lastMsg.getSenderEncryptedKey() == null ? "" : lastMsg.getSenderEncryptedKey(),
                    "iv", lastMsg.getIv() == null ? "" : lastMsg.getIv()
                ));
            } else {
                map.put("lastMessage", null);
            }

            return map;
        }).filter(Objects::nonNull).collect(Collectors.toList());

        // Sort by last message date
        formatted.sort((a, b) -> {
            Map<?, ?> msgA = (Map<?, ?>) a.get("lastMessage");
            Map<?, ?> msgB = (Map<?, ?>) b.get("lastMessage");
            Instant tA = msgA == null ? Instant.ofEpochMilli(0) : (Instant) msgA.get("createdAt");
            Instant tB = msgB == null ? Instant.ofEpochMilli(0) : (Instant) msgB.get("createdAt");
            return tB.compareTo(tA);
        });

        return ResponseEntity.ok(formatted);
    }

    // --- 11. CHECK DIRECT CONVERSATION ---
    @GetMapping("/direct/{userId}")
    public ResponseEntity<?> checkDirectConversation(@PathVariable Integer userId) {
        Integer currentUserId = getAuthenticatedUser().getId();
        Optional<DirectConversation> existing = directConversationRepository.findConversationBetween(currentUserId, userId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("exists", true, "conversationId", existing.get().getId()));
        }
        return ResponseEntity.ok(Map.of("exists", false));
    }
}

package com.chatsphere.server.socket;

import com.chatsphere.server.document.Message;
import com.chatsphere.server.entity.CallHistory;
import com.chatsphere.server.entity.User;
import com.chatsphere.server.repository.CallHistoryRepository;
import com.chatsphere.server.repository.MessageRepository;
import com.chatsphere.server.repository.UserRepository;
import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SocketHandler {

    private final SocketIOServer server;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final CallHistoryRepository callHistoryRepository;

    private final Map<String, String> onlineUsers = new ConcurrentHashMap<>();
    private final Map<String, String> socketToUser = new ConcurrentHashMap<>();

    public SocketHandler(SocketIOServer server, MessageRepository messageRepository,
                         UserRepository userRepository, CallHistoryRepository callHistoryRepository) {
        this.server = server;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.callHistoryRepository = callHistoryRepository;

        registerListeners();
    }

    private void broadcastPresence() {
        Map<String, String> statusMap = new HashMap<>();
        for (String uid : onlineUsers.keySet()) {
            statusMap.put(uid, "Online");
        }
        server.getBroadcastOperations().sendEvent("onlineUsersUpdated", statusMap);
    }

    private void sendToTarget(String to, String eventName, Object payload) {
        if (to == null) return;
        
        if (to.length() > 15) {
            // It's a session UUID string directly
            try {
                com.corundumstudio.socketio.SocketIOClient targetClient = server.getClient(UUID.fromString(to));
                if (targetClient != null) {
                    targetClient.sendEvent(eventName, payload);
                }
            } catch (Exception ignored) {}
        } else {
            // It's a userId, send to online user session if available
            String targetSessionId = onlineUsers.get(to);
            if (targetSessionId != null) {
                try {
                    com.corundumstudio.socketio.SocketIOClient targetClient = server.getClient(UUID.fromString(targetSessionId));
                    if (targetClient != null) {
                        targetClient.sendEvent(eventName, payload);
                    }
                } catch (Exception ignored) {}
            }
            // Also send to room
            server.getRoomOperations("user_" + to).sendEvent(eventName, payload);
        }
    }

    private void registerListeners() {
        // --- Connection Listener ---
        server.addConnectListener(client -> {
            System.out.println("[Socket] Connected: " + client.getSessionId());
        });

        // --- Disconnection Listener ---
        server.addDisconnectListener(client -> {
            String sessionId = client.getSessionId().toString();
            String userId = socketToUser.remove(sessionId);
            if (userId != null) {
                onlineUsers.remove(userId);
                java.util.concurrent.CompletableFuture.runAsync(() -> {
                    try {
                        Integer uId = Integer.parseInt(userId);
                        User user = userRepository.findById(uId).orElse(null);
                        if (user != null) {
                            user.setIsOnline(false);
                            user.setLastSeen(java.time.LocalDateTime.now());
                            userRepository.save(user);
                        }
                    } catch (Exception ignored) {}
                    broadcastPresence();
                    System.out.println("[Socket] Disconnected user: " + userId);
                });
            }
        });

        // --- User Online ---
        server.addEventListener("userOnline", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String userId = String.valueOf(data.get("userId"));
            String username = (String) data.get("username");
            if (userId == null || userId.equals("null")) return;

            String sessionId = client.getSessionId().toString();
            onlineUsers.put(userId, sessionId);
            socketToUser.put(sessionId, userId);

            client.joinRoom("user_" + userId);

            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    Integer uId = Integer.parseInt(userId);
                    User user = userRepository.findById(uId).orElse(null);
                    if (user != null) {
                        user.setIsOnline(true);
                        userRepository.save(user);
                    }
                } catch (Exception ignored) {}

                broadcastPresence();
                System.out.println("[Presence] User " + userId + " online on session " + sessionId);
            });
        });

        // --- Room Join & Leave ---
        server.addEventListener("joinRoom", String.class, (client, roomId, ackSender) -> {
            client.joinRoom(roomId);
        });

        server.addEventListener("leaveRoom", String.class, (client, roomId, ackSender) -> {
            client.leaveRoom(roomId);
        });

        // --- Send Message ---
        server.addEventListener("sendMessage", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    Message msg = new Message();
                    msg.setSenderId(data.get("senderId"));
                    msg.setSenderName((String) data.get("senderName"));
                    msg.setSenderProfilePic((String) data.get("senderProfilePic"));
                    
                    String roomId = (String) data.get("roomId");
                    msg.setRoomId(roomId);
                    if (roomId != null && roomId.startsWith("dm_")) {
                        msg.setConversationId(roomId.replace("dm_", ""));
                    }
                    
                    msg.setContent((String) data.get("content"));
                    msg.setType(data.get("type") == null ? "text" : (String) data.get("type"));
                    msg.setFileUrl((String) data.get("fileUrl"));
                    msg.setFileName((String) data.get("fileName"));
                    msg.setFileType((String) data.get("fileType"));
                    
                    if (data.get("size") != null) {
                        msg.setSize(Long.valueOf(data.get("size").toString()));
                    }
                    if (data.get("isEncrypted") != null) {
                        msg.setIsEncrypted((Boolean) data.get("isEncrypted"));
                    }
                    msg.setEncryptedKey((String) data.get("encryptedKey"));
                    msg.setSenderEncryptedKey((String) data.get("senderEncryptedKey"));
                    msg.setIv((String) data.get("iv"));

                    if ("call".equals(msg.getType())) {
                        msg.setCallType((String) data.get("callType"));
                        if (data.get("duration") != null) {
                            msg.setDuration(Integer.valueOf(data.get("duration").toString()));
                        }
                    }

                    Message saved = messageRepository.save(msg);

                    // Broadcast back to the room
                    Map<String, Object> emitData = new HashMap<>(data);
                    emitData.put("id", saved.getId());
                    emitData.put("_id", saved.getId());
                    emitData.put("createdAt", saved.getCreatedAt().toString());
                    server.getRoomOperations(saved.getRoomId()).sendEvent("newMessage", emitData);

                    // Sidebar update
                    Map<String, Object> sbUpdate = new HashMap<>();
                    sbUpdate.put("conversationId", msg.getConversationId());
                    sbUpdate.put("content", "media".equals(msg.getType()) ? "📎 " + (msg.getFileName() == null ? "Media" : msg.getFileName()) :
                                 "call".equals(msg.getType()) ? ("video".equals(msg.getCallType()) ? "📹 Video call" : "📞 Voice call") : msg.getContent());
                    sbUpdate.put("senderId", msg.getSenderId());
                    sbUpdate.put("createdAt", saved.getCreatedAt().toString());
                    sbUpdate.put("type", msg.getType());
                    sbUpdate.put("fileName", msg.getFileName());
                    sbUpdate.put("isEncrypted", msg.getIsEncrypted());
                    sbUpdate.put("encryptedKey", msg.getEncryptedKey());
                    sbUpdate.put("senderEncryptedKey", msg.getSenderEncryptedKey());
                    sbUpdate.put("iv", msg.getIv());

                    server.getBroadcastOperations().sendEvent("sidebarUpdate", sbUpdate);
                } catch (Exception e) {
                    System.err.println("Error saving/emitting message: " + e.getMessage());
                    if (data.get("tempId") != null) {
                        client.sendEvent("messageFailed", Map.of("tempId", data.get("tempId")));
                    }
                }
            });
        });

        // --- Read Messages ---
        server.addEventListener("readMessages", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String roomId = (String) data.get("roomId");
            String userId = String.valueOf(data.get("userId"));
            if (roomId == null || userId == null || userId.equals("null")) return;

            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    List<Message> messages;
                    if (roomId.startsWith("dm_")) {
                        String convId = roomId.replace("dm_", "");
                        messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(convId);
                    } else {
                        messages = messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
                    }

                    boolean updated = false;
                    for (Message msg : messages) {
                        if (!userId.equals(String.valueOf(msg.getSenderId())) && !"read".equals(msg.getStatus())) {
                            msg.setStatus("read");
                            messageRepository.save(msg);
                            updated = true;
                        }
                    }

                    if (updated) {
                        Map<String, Object> payload = Map.of("roomId", roomId, "readerId", userId);
                        server.getRoomOperations(roomId).sendEvent("messagesRead", payload);
                    }
                } catch (Exception e) {
                    System.err.println("Error marking messages as read: " + e.getMessage());
                }
            });
        });

        // --- Typing indicators ---
        server.addEventListener("typing", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String roomId = (String) data.get("roomId");
            if (roomId != null) {
                client.getNamespace().getRoomOperations(roomId).sendEvent("userTyping", client, data);
            }
        });

        server.addEventListener("stopTyping", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String roomId = (String) data.get("roomId");
            if (roomId != null) {
                client.getNamespace().getRoomOperations(roomId).sendEvent("userStoppedTyping", client, data);
            }
        });

        // --- Profile updates ---
        server.addEventListener("updateProfile", Map.class, (client, data, ackSender) -> {
            server.getBroadcastOperations().sendEvent("profileUpdated", data);
        });

        // --- WebRTC Signaling ---
        server.addEventListener("callUser", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String userToCall = String.valueOf(data.get("userToCall"));
            
            Map<String, Object> payload = Map.of(
                "signal", data.get("signalData"),
                "from", client.getSessionId().toString(), 
                "fromUserId", data.get("from"),
                "username", data.get("name"),
                "callType", data.get("callType")
            );

            sendToTarget(userToCall, "incomingCall", payload);
        });

        server.addEventListener("answerCall", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String to = (String) data.get("to");
            Object signal = data.get("signal");
            sendToTarget(to, "callAccepted", signal);
        });

        server.addEventListener("callAnswered", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String to = (String) data.get("to");
            Object signal = data.get("signal");
            sendToTarget(to, "callAnswered", Map.of("signal", signal, "from", client.getSessionId().toString()));
        });

        server.addEventListener("rejectCall", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String to = (String) data.get("to");
            sendToTarget(to, "callRejected", new HashMap<>());
        });

        server.addEventListener("endCall", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String to = (String) data.get("to");
            sendToTarget(to, "callEnded", new HashMap<>());
        });

        server.addEventListener("iceCandidate", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            String to = (String) data.get("to");
            Object candidate = data.get("candidate");
            sendToTarget(to, "iceCandidate", Map.of("candidate", candidate, "from", client.getSessionId().toString()));
        });

        // --- Call History Persistence ---
        server.addEventListener("saveCallHistory", Map.class, (client, data, ackSender) -> {
            if (data == null) return;
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    Integer callerId = Integer.valueOf(data.get("callerId").toString());
                    Integer receiverId = Integer.valueOf(data.get("receiverId").toString());
                    String callType = (String) data.get("callType");
                    String status = (String) data.get("status");
                    
                    Integer durationSeconds = 0;
                    if (data.get("durationSeconds") != null) {
                        durationSeconds = Integer.valueOf(data.get("durationSeconds").toString());
                    }

                    CallHistory ch = new CallHistory();
                    ch.setCallerId(callerId);
                    ch.setReceiverId(receiverId);
                    ch.setCallType(callType == null ? "audio" : callType);
                    ch.setStatus(status == null ? "answered" : status);
                    ch.setDurationSeconds(durationSeconds);
                    callHistoryRepository.save(ch);

                    server.getRoomOperations("user_" + callerId).sendEvent("callHistoryUpdate");
                    server.getRoomOperations("user_" + receiverId).sendEvent("callHistoryUpdate");
                } catch (Exception e) {
                    System.err.println("Error saving call history over socket: " + e.getMessage());
                }
            });
        });
    }
}

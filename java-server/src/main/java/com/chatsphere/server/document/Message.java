package com.chatsphere.server.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
public class Message {

    @Id
    private String id; // Mapped to MongoDB _id (usually String)

    private String roomId;
    private String conversationId;
    private Object senderId; // Can be Integer/Long or String
    private String senderName;
    private String senderProfilePic;
    private String content = "";
    private String type = "text"; // text, media, call, ai

    // Media fields
    private String fileUrl;
    private String fileName;
    private String fileType;
    private Long size = 0L;

    // Call fields
    private String callType; // audio, video
    private Integer duration = 0;

    // E2EE fields
    private Boolean isEncrypted = false;
    private String encryptedKey;
    private String senderEncryptedKey;
    private String iv;

    // Status
    private String status = "sent"; // sent, delivered, read

    private Instant createdAt = Instant.now();

    private List<Reaction> reactions = new ArrayList<>();

    // Inner classes for reactions
    public static class Reaction {
        private String emoji;
        private List<ReactionUser> users = new ArrayList<>();

        public String getEmoji() { return emoji; }
        public void setEmoji(String emoji) { this.emoji = emoji; }

        public List<ReactionUser> getUsers() { return users; }
        public void setUsers(List<ReactionUser> users) { this.users = users; }
    }

    public static class ReactionUser {
        private Object userId;
        private String username;

        public ReactionUser() {}
        public ReactionUser(Object userId, String username) {
            this.userId = userId;
            this.username = username;
        }

        public Object getUserId() { return userId; }
        public void setUserId(Object userId) { this.userId = userId; }

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public Object getSenderId() { return senderId; }
    public void setSenderId(Object senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderProfilePic() { return senderProfilePic; }
    public void setSenderProfilePic(String senderProfilePic) { this.senderProfilePic = senderProfilePic; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public String getCallType() { return callType; }
    public void setCallType(String callType) { this.callType = callType; }

    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }

    public Boolean getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Boolean isEncrypted) { this.isEncrypted = isEncrypted; }

    public String getEncryptedKey() { return encryptedKey; }
    public void setEncryptedKey(String encryptedKey) { this.encryptedKey = encryptedKey; }

    public String getSenderEncryptedKey() { return senderEncryptedKey; }
    public void setSenderEncryptedKey(String senderEncryptedKey) { this.senderEncryptedKey = senderEncryptedKey; }

    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public List<Reaction> getReactions() { return reactions; }
    public void setReactions(List<Reaction> reactions) { this.reactions = reactions; }
}

package com.chatsphere.server.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "DirectConversations")
public class DirectConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user1_id", nullable = false)
    private Integer user1Id;

    @Column(name = "user2_id", nullable = false)
    private Integer user2Id;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "user1_cleared_at")
    private LocalDateTime user1ClearedAt;

    @Column(name = "user2_cleared_at")
    private LocalDateTime user2ClearedAt;

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getUser1Id() { return user1Id; }
    public void setUser1Id(Integer user1Id) { this.user1Id = user1Id; }

    public Integer getUser2Id() { return user2Id; }
    public void setUser2Id(Integer user2Id) { this.user2Id = user2Id; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUser1ClearedAt() { return user1ClearedAt; }
    public void setUser1ClearedAt(LocalDateTime user1ClearedAt) { this.user1ClearedAt = user1ClearedAt; }

    public LocalDateTime getUser2ClearedAt() { return user2ClearedAt; }
    public void setUser2ClearedAt(LocalDateTime user2ClearedAt) { this.user2ClearedAt = user2ClearedAt; }
}

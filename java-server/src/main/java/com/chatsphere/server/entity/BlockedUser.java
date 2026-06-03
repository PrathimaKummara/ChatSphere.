package com.chatsphere.server.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "BlockedUsers", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"blocker_id", "blocked_id"})
})
public class BlockedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "blocker_id", nullable = false)
    private Integer blockerId;

    @Column(name = "blocked_id", nullable = false)
    private Integer blockedId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getBlockerId() { return blockerId; }
    public void setBlockerId(Integer blockerId) { this.blockerId = blockerId; }

    public Integer getBlockedId() { return blockedId; }
    public void setBlockedId(Integer blockedId) { this.blockedId = blockedId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

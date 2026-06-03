package com.chatsphere.server.repository;

import com.chatsphere.server.entity.BlockedUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BlockedUserRepository extends JpaRepository<BlockedUser, Integer> {
    boolean existsByBlockerIdAndBlockedId(Integer blockerId, Integer blockedId);
    Optional<BlockedUser> findByBlockerIdAndBlockedId(Integer blockerId, Integer blockedId);
}

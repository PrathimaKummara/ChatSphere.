package com.chatsphere.server.repository;

import com.chatsphere.server.entity.MessageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MessageRequestRepository extends JpaRepository<MessageRequest, Integer> {
    List<MessageRequest> findByToUserIdAndStatus(Integer toUserId, String status);
    Optional<MessageRequest> findByFromUserIdAndToUserIdAndStatus(Integer fromUserId, Integer toUserId, String status);
}

package com.chatsphere.server.repository;

import com.chatsphere.server.entity.CallHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface CallHistoryRepository extends JpaRepository<CallHistory, Integer> {

    interface CallHistoryInfo {
        Integer getId();
        Integer getCallerId();
        Integer getReceiverId();
        String getCallType();
        String getStatus();
        LocalDateTime getStartedAt();
        Integer getDurationSeconds();
        String getCallerName();
        String getCallerPic();
        String getReceiverName();
        String getReceiverPic();
    }

    @Query(value = 
        "SELECT c.id as id, c.caller_id as callerId, c.receiver_id as receiverId, " +
        "c.call_type as callType, c.status as status, c.started_at as startedAt, " +
        "c.duration_seconds as durationSeconds, " +
        "u1.username as callerName, u1.profile_pic as callerPic, " +
        "u2.username as receiverName, u2.profile_pic as receiverPic " +
        "FROM callhistory c " +
        "JOIN Users u1 ON c.caller_id = u1.id " +
        "JOIN Users u2 ON c.receiver_id = u2.id " +
        "WHERE c.caller_id = :userId OR c.receiver_id = :userId " +
        "ORDER BY c.started_at DESC", 
        nativeQuery = true)
    List<CallHistoryInfo> findUserCallHistory(@Param("userId") Integer userId);
}

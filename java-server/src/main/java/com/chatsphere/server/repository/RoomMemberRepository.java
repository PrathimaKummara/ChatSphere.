package com.chatsphere.server.repository;

import com.chatsphere.server.entity.RoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Integer> {
    List<RoomMember> findByRoomId(Integer roomId);
    List<RoomMember> findByUserId(Integer userId);
    
    @Transactional
    void deleteByRoomIdAndUserId(Integer roomId, Integer userId);
}

package com.chatsphere.server.repository;

import com.chatsphere.server.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface RoomRepository extends JpaRepository<Room, Integer> {

    interface RoomInfo {
        Integer getId();
        String getName();
        LocalDateTime getCreatedAt();
        String getCreatedByName();
        Integer getMemberCount();
    }

    @Query(value = 
        "SELECT r.id as id, r.name as name, r.created_at as createdAt, " +
        "u.username as createdByName, COUNT(rm2.user_id) as memberCount " +
        "FROM Rooms r " +
        "JOIN RoomMembers rm ON r.id = rm.room_id AND rm.user_id = :userId " +
        "LEFT JOIN Users u ON r.created_by = u.id " +
        "LEFT JOIN RoomMembers rm2 ON r.id = rm2.room_id " +
        "GROUP BY r.id, r.name, r.created_at, u.username " +
        "ORDER BY r.created_at DESC", 
        nativeQuery = true)
    List<RoomInfo> findRoomsByMemberId(@Param("userId") Integer userId);
}

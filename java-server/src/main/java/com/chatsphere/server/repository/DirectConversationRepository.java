package com.chatsphere.server.repository;

import com.chatsphere.server.entity.DirectConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface DirectConversationRepository extends JpaRepository<DirectConversation, Integer> {
    
    @Query("SELECT d FROM DirectConversation d WHERE (d.user1Id = :u1 AND d.user2Id = :u2) OR (d.user1Id = :u2 AND d.user2Id = :u1)")
    Optional<DirectConversation> findConversationBetween(@Param("u1") Integer user1Id, @Param("u2") Integer user2Id);
    
    List<DirectConversation> findByUser1IdOrUser2Id(Integer user1Id, Integer user2Id);
}

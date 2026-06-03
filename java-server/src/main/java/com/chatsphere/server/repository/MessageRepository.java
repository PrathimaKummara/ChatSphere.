package com.chatsphere.server.repository;

import com.chatsphere.server.document.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<Message, String> {
    
    List<Message> findByRoomIdOrderByCreatedAtAsc(String roomId);
    
    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);
    
    List<Message> findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(String conversationId, Instant createdAt);
    
    @Query("{ '$or': [ { 'conversationId': ?0 }, { 'roomId': ?1 } ], 'type': 'media' }")
    List<Message> findMediaMessages(String conversationId, String roomId, Pageable pageable);

    // Finding last message methods
    Optional<Message> findFirstByConversationIdOrderByCreatedAtDesc(String conversationId);
    Optional<Message> findFirstByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtDesc(String conversationId, Instant createdAt);

    @Query("{ '$or': [ { 'conversationId': ?0 }, { 'roomId': ?1 } ] }")
    List<Message> findFirstByConversationIdOrRoomIdOrderByCreatedAtDesc(String conversationId, String roomId, Pageable pageable);

    @Query("{ '$or': [ { 'conversationId': ?0 }, { 'roomId': ?1 } ], 'createdAt': { '$gt': ?2 } }")
    List<Message> findFirstByConversationIdOrRoomIdAndCreatedAtGreaterThanOrderByCreatedAtDesc(String conversationId, String roomId, Instant createdAt, Pageable pageable);
}

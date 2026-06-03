package com.chatsphere.server.controller;

import com.chatsphere.server.entity.Room;
import com.chatsphere.server.entity.RoomMember;
import com.chatsphere.server.repository.RoomMemberRepository;
import com.chatsphere.server.repository.RoomRepository;
import com.chatsphere.server.security.JwtAuthenticationFilter.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;

    public RoomController(RoomRepository roomRepository, RoomMemberRepository roomMemberRepository) {
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
    }

    private UserPrincipal getAuthenticatedUser() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // --- 1. CREATE GROUP ROOM ---
    @PostMapping("/create")
    @Transactional
    public ResponseEntity<?> createRoom(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        List<?> memberIdsRaw = (List<?>) request.get("memberIds");

        if (name == null || name.trim().length() < 2) {
            return ResponseEntity.badRequest().body(Map.of("message", "Group name must be at least 2 characters"));
        }

        Integer creatorId = getAuthenticatedUser().getId();

        // Save Room
        Room room = new Room();
        room.setName(name.trim());
        room.setCreatedBy(creatorId);
        Room savedRoom = roomRepository.save(room);

        // Add creator as member
        RoomMember creatorMember = new RoomMember();
        creatorMember.setRoomId(savedRoom.getId());
        creatorMember.setUserId(creatorId);
        roomMemberRepository.save(creatorMember);

        // Add other members
        if (memberIdsRaw != null) {
            Set<Integer> uniqueMemberIds = new HashSet<>();
            for (Object obj : memberIdsRaw) {
                if (obj instanceof Number) {
                    uniqueMemberIds.add(((Number) obj).intValue());
                } else if (obj instanceof String) {
                    try {
                        uniqueMemberIds.add(Integer.parseInt((String) obj));
                    } catch (NumberFormatException ignored) {}
                }
            }
            uniqueMemberIds.remove(creatorId); // Exclude creator

            List<RoomMember> membersToSave = new ArrayList<>();
            for (Integer memberId : uniqueMemberIds) {
                RoomMember rm = new RoomMember();
                rm.setRoomId(savedRoom.getId());
                rm.setUserId(memberId);
                membersToSave.add(rm);
            }
            if (!membersToSave.isEmpty()) {
                roomMemberRepository.saveAll(membersToSave);
            }
        }

        Map<String, Object> responseBody = new java.util.HashMap<>();
        responseBody.put("message", "Group created successfully");
        responseBody.put("room", Map.of(
            "id", savedRoom.getId(),
            "name", savedRoom.getName(),
            "created_by", savedRoom.getCreatedBy()
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
    }

    // --- 2. GET USER GROUP ROOMS ---
    @GetMapping
    public ResponseEntity<?> getRooms() {
        Integer userId = getAuthenticatedUser().getId();
        List<RoomRepository.RoomInfo> rooms = roomRepository.findRoomsByMemberId(userId);

        List<Map<String, Object>> formatted = rooms.stream().map(r -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", r.getId());
            map.put("name", r.getName());
            map.put("created_at", r.getCreatedAt());
            map.put("created_by_name", r.getCreatedByName() == null ? "" : r.getCreatedByName());
            map.put("member_count", r.getMemberCount());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(formatted);
    }

    // --- 3. LEAVE GROUP ROOM ---
    @DeleteMapping("/{roomId}/leave")
    @Transactional
    public ResponseEntity<?> leaveRoom(@PathVariable Integer roomId) {
        Integer userId = getAuthenticatedUser().getId();
        roomMemberRepository.deleteByRoomIdAndUserId(roomId, userId);
        return ResponseEntity.ok(Map.of("message", "Left group successfully"));
    }
}

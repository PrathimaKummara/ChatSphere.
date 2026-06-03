package com.chatsphere.server.controller;

import com.chatsphere.server.repository.CallHistoryRepository;
import com.chatsphere.server.security.JwtAuthenticationFilter.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/calls")
public class CallController {

    private final CallHistoryRepository callHistoryRepository;

    public CallController(CallHistoryRepository callHistoryRepository) {
        this.callHistoryRepository = callHistoryRepository;
    }

    private UserPrincipal getAuthenticatedUser() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // --- GET HISTORY ---
    @GetMapping("/history")
    public ResponseEntity<?> getCallHistory() {
        Integer userId = getAuthenticatedUser().getId();
        List<CallHistoryRepository.CallHistoryInfo> calls = callHistoryRepository.findUserCallHistory(userId);

        List<Map<String, Object>> formatted = calls.stream().map(c -> {
            boolean isCaller = c.getCallerId().equals(userId);
            
            Map<String, Object> otherPerson = Map.of(
                "id", isCaller ? c.getReceiverId() : c.getCallerId(),
                "name", isCaller ? c.getReceiverName() : c.getCallerName(),
                "profile_pic", (isCaller ? c.getReceiverPic() : c.getCallerPic()) == null ? "" : (isCaller ? c.getReceiverPic() : c.getCallerPic())
            );

            return Map.of(
                "id", c.getId(),
                "type", c.getCallType(),
                "status", c.getStatus(),
                "started_at", c.getStartedAt(),
                "duration", c.getDurationSeconds(),
                "isOutgoing", isCaller,
                "otherPerson", otherPerson
            );
        }).collect(Collectors.toList());

        return ResponseEntity.ok(formatted);
    }
}

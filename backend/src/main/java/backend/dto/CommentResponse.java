package backend.dto;

import java.time.Instant;

public record CommentResponse(
        Long id,
        Long characterId,
        String characterName,
        String text,
        Instant createdAt,
        Instant updatedAt
) {
}

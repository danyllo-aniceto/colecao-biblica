package backend.dto;

import backend.model.Role;

import java.time.Instant;

public record UserResponse(Long id,
				   int xp,
				   int level,
				   int coins,
				   int totalScore,
				   int extraLifeBoosts,
				   int extraTimeBoosts,
				   int doubleXpBoosts,
						   String name,
						   String email,
						   Role role,
						   Instant createdAt,
						   Instant updatedAt,
						   String createdBy,
						   String updatedBy,
						   boolean deleted,
						   Instant deletedAt,
						   String deletedBy) {
}

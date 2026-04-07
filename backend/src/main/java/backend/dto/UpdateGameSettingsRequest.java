package backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateGameSettingsRequest(
        @Min(1) @Max(1000) Integer maxQuestionsPerMatch,
        @Min(1) @Max(20) Integer startingLives,
        @Min(0) @Max(20) Integer rewardMatchLimitPerDay,
        @Min(0) @Max(100) Integer characterStudyXpPercent
) {
}

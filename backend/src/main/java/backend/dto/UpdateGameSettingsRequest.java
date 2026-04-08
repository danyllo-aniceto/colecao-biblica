package backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

public record UpdateGameSettingsRequest(
        @Min(1) @Max(1000) Integer maxQuestionsPerMatch,
        @Min(1) @Max(20) Integer startingLives,
        @Min(0) @Max(20) Integer rewardMatchLimitPerDay,
        @Min(0) @Max(100) Integer characterStudyXpPercent,
        @Min(1) @Max(20) Integer maxExtraLifeBoosts,
        @Min(1) @Max(20) Integer maxExtraTimeBoosts,
        @Min(1) @Max(20) Integer maxDoubleXpBoosts,
        @DecimalMin("1.0") @DecimalMax("10.0") Double doubleXpMultiplier
) {
}

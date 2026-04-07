package backend.dto;

public record GameSettingsResponse(
        int maxQuestionsPerMatch,
        int startingLives,
        int rewardMatchLimitPerDay,
        int characterStudyXpPercent
) {
}

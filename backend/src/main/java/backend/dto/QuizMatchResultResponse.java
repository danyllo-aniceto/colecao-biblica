package backend.dto;

public record QuizMatchResultResponse(
        Long matchId,
        int xpGained,
        int scoreGained,
        boolean rewardGranted,
        String rewardName,
        String rewardType,
        Long rewardCharacterId,
        String rewardCharacterName,
        String rewardCharacterRarity,
        boolean rewardCharacterUnlocked,
        int userXp,
        int userLevel,
        int userCoins,
        int rewardMatchesUsedToday,
        int rewardMatchesLimitPerDay
) {
}

package backend.dto;

public record QuizMatchResultResponse(
        Long matchId,
        int xpGained,
        int scoreGained,
        boolean rewardGranted,
        String rewardName,
        int userXp,
        int userLevel,
        int userCoins,
        int rewardMatchesUsedToday,
        int rewardMatchesLimitPerDay
) {
}
